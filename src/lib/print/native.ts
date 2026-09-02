/**
 * Direct printing, where the platform allows it.
 *
 * A browser cannot open a TCP socket, so the web build always goes through
 * the cloud queue. The native till app (Capacitor shell around this same
 * web app) registers a TcpPrint plugin with exactly one ability: write raw
 * bytes to a LAN host and port. When that plugin is present, the till
 * prints the way Sapo prints — straight at the printer, instantly, wifi
 * only, no bridge machine anywhere.
 *
 * Detection is capability-based, never user-agent-based: if the plugin can
 * be called, direct printing exists; otherwise this module says no and the
 * queue path runs as always.
 */

type TcpPrintPlugin = {
  send(options: {
    host: string;
    port: number;
    dataBase64: string;
    timeoutMs?: number;
  }): Promise<{ ok: boolean; error?: string }>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: Record<string, unknown>;
};

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

function plugin(): TcpPrintPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable("TcpPrint")) return null;
  const found = cap.Plugins?.TcpPrint as TcpPrintPlugin | undefined;
  return found && typeof found.send === "function" ? found : null;
}

/** True when this device can put bytes on the printer's port itself. */
export function nativePrintAvailable(): boolean {
  return plugin() !== null;
}

const RAW_PRINT_PORT = 9100;

/**
 * Send rendered ESC/POS bytes straight to a printer. Resolves false on any
 * failure — wrong IP, printer off, cable out — so the caller can fall back
 * to the queue and TELL someone, which is the part that keeps trust.
 */
export async function nativePrintRaw(host: string, bytes: Uint8Array): Promise<boolean> {
  const tcp = plugin();
  if (!tcp || !host) return false;
  let binary = "";
  // btoa takes a binary string; build it in chunks to dodge arg limits.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  try {
    const result = await tcp.send({
      host,
      port: RAW_PRINT_PORT,
      dataBase64: btoa(binary),
      timeoutMs: 5000,
    });
    return result.ok === true;
  } catch {
    return false;
  }
}
