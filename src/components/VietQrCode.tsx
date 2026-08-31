"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * The payment QR, rendered for a guest to scan off the device.
 *
 * Error correction "M" and a wide quiet zone, because this gets scanned off a
 * screen at arm's length across a table, often at an angle and under
 * restaurant lighting. Rendered as SVG so it stays sharp when the tablet
 * scales it up.
 */
export function VietQrCode({ payload, size = 260 }: { payload: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 2 })
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (failed) {
    return (
      <p className="text-sm text-warning text-center">
        Could not draw the QR — take cash or card instead.
        <br />
        <span className="opacity-80">Không tạo được mã — nhận tiền mặt hoặc thẻ.</span>
      </p>
    );
  }

  return (
    <div
      className="mx-auto bg-white rounded-xl p-2"
      style={{ width: size, height: size }}
      // Generated in this component from a payload we built; nothing here
      // comes from a guest or the network.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    >
      {!svg ? <span className="block w-full h-full animate-pulse bg-border/40 rounded" /> : null}
    </div>
  );
}
