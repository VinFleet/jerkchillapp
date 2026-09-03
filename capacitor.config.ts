import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native till shell — a webview around the DEPLOYED app, not a bundled
 * copy. server.url means every product update ships through Vercel exactly
 * like the web; the store binary only changes when native code does (today:
 * the TcpPrint plugin). What the shell adds is the one thing a browser
 * cannot give the till: a TCP socket to the printers.
 */
const config: CapacitorConfig = {
  appId: "vn.vinpos.till",
  appName: "VINPOS",
  webDir: "capacitor-shell",
  server: {
    url: "https://jerkchillapp.vercel.app",
    cleartext: false,
  },
};

export default config;
