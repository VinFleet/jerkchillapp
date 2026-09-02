# The native till app — printing without a bridge machine

## Why it exists

A commercial POS cannot ask customers to run a Node process on a spare
machine. Sapo prints from the phone because Sapo is a native app with a
real TCP socket; this shell gives VINPOS the same ability. The till app
is the same deployed web app (it loads `https://jerkchillapp.vercel.app`
— every product update still ships through Vercel) plus one native
plugin, **TcpPrint**, which writes raw bytes to a LAN host and port.
Rendering, routing, fallbacks and settings all stay in the web code.

With the app installed on the till, a new restaurant needs exactly two
things: the app, and the printer's IP typed into Settings → Printing.

## What the till app does

| Path | Behaviour |
|---|---|
| Its own sends | Rendered on-device, TCP straight to the printer. Instant, works with NO internet (wifi only). |
| Guest-QR orders & other devices' sends | Land in the cloud `print_jobs` queue as always; the till's built-in worker (`src/lib/print/tillWorker.ts`) claims and prints them — same compare-and-swap as the bridge, so running a bridge *too* never double-prints. |
| Heartbeat | The till writes the same `print_bridge_status` pulse the bridge does, so web devices' "will my ticket print?" warning keeps working unchanged. |

The old bridge (`tools/print-bridge`) still works and stays supported —
it becomes the option for setups whose till is an iPad without the app,
or who want a dedicated print machine. It is no longer a requirement.

Run `supabase/native-till-schema.sql` once: it lets member sessions
claim/complete their own branch's jobs and write its heartbeat
(previously service-role-only).

## Building

CI builds both on every native-code push (`.github/workflows/till-apps.yml`):

- **Android**: the `vinpos-till-debug-apk` artifact on the Actions run is
  a real APK — download, copy to the tablet, install (allow "unknown
  sources"). Good for our own restaurants and pilots; a Play Store
  release later needs a signing keystore.
- **iOS**: CI compiles against the simulator SDK as a check. Shipping to
  a real iPhone/iPad needs the Apple Developer Program ($99/yr) and
  certificates — then a signed archive job gets added here, and
  customers install from TestFlight/App Store.

Local builds, if ever needed: `npx cap sync`, then `android/gradlew
assembleDebug` (JDK 21 + Android SDK) or open `ios/App` in Xcode.

## Native surface (kept deliberately tiny)

`TcpPrint.send({host, port, dataBase64, timeoutMs}) → {ok, error?}` —
that is the entire API. Errors resolve, never reject. The smaller this
surface, the rarer a store re-release: web code changes daily, the
binary almost never.

- Android: `android/.../TcpPrintPlugin.java`, registered in MainActivity.
- iOS: `ios/App/App/TcpPrintPlugin.swift` (NWConnection), discovered via
  `packageClassList`; first print triggers the iOS local-network
  permission prompt, explained bilingually in Info.plist.
