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

        executor.execute(() -> {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), timeoutMs);
                socket.setSoTimeout(timeoutMs);
                OutputStream out = socket.getOutputStream();
                out.write(bytes);
                out.flush();
                JSObject ok = new JSObject();
                ok.put("ok", true);
                call.resolve(ok);
            } catch (Exception e) {
                call.resolve(fail(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
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
