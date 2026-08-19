"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import type { PhotoRef } from "@/lib/types";
import { getPhotoUrl } from "@/lib/photos/upload";
import { getPendingPhoto } from "@/lib/photos/store";

/**
 * Shows the record's small preview, and fetches the full-resolution copy from
 * Storage on tap. An inspector looking at a delivery note needs to read it,
 * not squint at a thumbnail — but pulling every full image up front would
 * defeat the point of moving them off the device.
 */
export function StoredPhoto({ photo, alt, className = "" }: { photo: PhotoRef; alt: string; className?: string }) {
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const openFull = async () => {
    setOpen(true);
    if (fullSrc || loading) return;
    setLoading(true);
    // Still on this device if the upload hasn't happened yet — that copy is
    // the original, so prefer it over a round trip.
    const pending = getPendingPhoto(photo.id);
    if (pending) {
      setFullSrc(pending.dataUrl);
      setLoading(false);
      return;
    }
    const url = photo.path ? await getPhotoUrl(photo.path) : null;
    if (url) setFullSrc(url);
    else setFailed(true);
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openFull}
        className={`relative w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0 ${className}`}
        aria-label={`View ${alt} full size`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumb} alt={alt} className="w-full h-full object-cover" />
        <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-black/55 text-white flex items-center justify-center">
          <Maximize2 size={9} />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label={alt}
        >
          {loading && <p className="text-white text-sm">Loading… · Đang tải…</p>}
          {failed && (
            <p className="text-white text-sm text-center max-w-xs">
              Can&apos;t load the full photo — check the connection.
              <br />
              Không tải được ảnh gốc — kiểm tra kết nối.
            </p>
          )}
          {fullSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fullSrc} alt={alt} className="max-w-full max-h-full object-contain rounded-lg" />
          )}
        </div>
      )}
    </>
  );
}
