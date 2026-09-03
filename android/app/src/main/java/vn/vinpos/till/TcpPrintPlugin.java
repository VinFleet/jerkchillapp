package vn.vinpos.till;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The one native ability the till needs: write raw bytes to a LAN socket.
 *
 * ESC/POS rendering, printer choice, retries and fallbacks all live in the
 * web app (src/lib/print) — this plugin is deliberately dumb so the store
 * binary almost never has to change. Errors resolve as {ok:false,error}
 * rather than reject, matching what native.ts expects.
 */
@CapacitorPlugin(name = "TcpPrint")
public class TcpPrintPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void send(PluginCall call) {
        final String host = call.getString("host", "");
        final int port = call.getInt("port", 9100);
        final int timeoutMs = call.getInt("timeoutMs", 5000);
        final String dataBase64 = call.getString("dataBase64", "");

        if (host == null || host.isEmpty() || dataBase64 == null || dataBase64.isEmpty()) {
            call.resolve(fail("bad arguments"));
            return;
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(dataBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.resolve(fail("invalid base64"));
            return;
        }

        // Jobs are issued one at a time (this executor) so tickets for one
        // printer come out in order. But Socket.setSoTimeout() only bounds
        // READS in Java — a printer that accepts the connection and then
        // stops draining can block write() forever, and with only one
        // thread here that would wedge every job queued after it too. The
        // actual socket work runs on its own short-lived thread; this call
        // waits at most timeoutMs for it, and if it hasn't finished,
        // force-closes the socket (which unblocks the stuck write with an
        // exception) and moves on rather than waiting on a dead connection.
        executor.execute(() -> {
            final AtomicReference<Socket> socketRef = new AtomicReference<>();
            final AtomicReference<Exception> errorRef = new AtomicReference<>();
            Thread worker = new Thread(() -> {
                try (Socket socket = new Socket()) {
                    socketRef.set(socket);
                    socket.connect(new InetSocketAddress(host, port), timeoutMs);
                    socket.setSoTimeout(timeoutMs);
                    OutputStream out = socket.getOutputStream();
                    out.write(bytes);
                    out.flush();
                } catch (Exception e) {
                    errorRef.set(e);
                }
            }, "tcpprint-send");
            worker.setDaemon(true);
            worker.start();
            try {
                worker.join(timeoutMs);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }

            if (worker.isAlive()) {
                // Still stuck past the deadline — force the socket closed so
                // the blocked write throws and the worker thread can exit on
                // its own; we don't wait for it, this job is already failed.
                Socket stuck = socketRef.get();
                if (stuck != null) {
                    try {
                        stuck.close();
                    } catch (Exception ignored) {
                    }
                }
                call.resolve(fail("write timeout after " + timeoutMs + "ms"));
                return;
            }

            Exception error = errorRef.get();
            if (error != null) {
                call.resolve(fail(error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName()));
            } else {
                JSObject ok = new JSObject();
                ok.put("ok", true);
                call.resolve(ok);
            }
        });
    }

    private JSObject fail(String error) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("error", error);
        return result;
    }
}
