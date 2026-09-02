import Capacitor
import Foundation
import Network

/**
 * The one native ability the till needs: write raw bytes to a LAN socket.
 *
 * ESC/POS rendering, printer choice, retries and fallbacks all live in the
 * web app (src/lib/print) — this plugin is deliberately dumb so the store
 * binary almost never has to change. Errors resolve as {ok:false, error}
 * rather than reject, matching what native.ts expects. First use triggers
 * iOS's local-network permission prompt (NSLocalNetworkUsageDescription).
 */
@objc(TcpPrintPlugin)
public class TcpPrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TcpPrintPlugin"
    public let jsName = "TcpPrint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise)
    ]

    private let queue = DispatchQueue(label: "vn.vinpos.till.tcpprint")

    @objc func send(_ call: CAPPluginCall) {
        guard
            let host = call.getString("host"), !host.isEmpty,
            let dataBase64 = call.getString("dataBase64"),
            let data = Data(base64Encoded: dataBase64),
            let port = NWEndpoint.Port(rawValue: UInt16(call.getInt("port") ?? 9100))
        else {
            call.resolve(["ok": false, "error": "bad arguments"])
            return
        }
        let timeoutMs = call.getInt("timeoutMs") ?? 5000

        let connection = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)

        // Everything below runs on one serial queue, so this flag is enough
        // to guarantee the call resolves exactly once — timeout included.
        var finished = false
        func finish(_ ok: Bool, _ error: String?) {
            if finished { return }
            finished = true
            connection.cancel()
            if ok {
                call.resolve(["ok": true])
            } else {
                call.resolve(["ok": false, "error": error ?? "send failed"])
            }
        }

        queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
            finish(false, "timeout after \(timeoutMs)ms")
        }

        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                connection.send(content: data, completion: .contentProcessed { sendError in
                    if let sendError = sendError {
                        finish(false, sendError.localizedDescription)
                    } else {
                        // A short linger lets the kernel flush before cancel —
                        // cutting the socket mid-buffer truncates the ticket.
                        self.queue.asyncAfter(deadline: .now() + .milliseconds(300)) {
                            finish(true, nil)
                        }
                    }
                })
            case .failed(let error):
                finish(false, error.localizedDescription)
            case .waiting(let error):
                // "waiting" retries forever on an unreachable host; for a
                // printer three metres away, waiting IS failure.
                finish(false, error.localizedDescription)
            default:
                break
            }
        }
        connection.start(queue: queue)
    }
}
