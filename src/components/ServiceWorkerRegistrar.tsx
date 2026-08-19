"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Only register in production — in dev the SW's fetch interception
    // fights with Turbopack's HMR chunk requests and can trigger reload loops.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is a nice-to-have; ignore registration failures
        // (e.g. unsupported browser).
      });
    }
  }, []);

  return null;
}
