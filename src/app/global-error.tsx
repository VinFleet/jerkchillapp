"use client";

/**
 * The last net: an error in the root layout itself, where no styles or
 * components can be assumed alive. Inline styles on purpose.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 18 }}>VINPOS hit an error</p>
          <p style={{ color: "#666", fontSize: 14 }}>
            Your data is safe on this device. · Dữ liệu vẫn an toàn.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 12, minHeight: 48, padding: "0 24px", borderRadius: 12, background: "#003295", color: "#fff", fontWeight: 600, border: 0 }}
          >
            Reload · Tải lại
          </button>
        </div>
      </body>
    </html>
  );
}
