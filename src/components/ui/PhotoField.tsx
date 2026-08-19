"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import type { Bi as BiValue } from "@/lib/types";
import { Bi } from "@/components/Bi";
import { compressImageFile } from "@/lib/imageCapture";

/** Photo capture via the phone camera (or file picker on desktop), stored as compressed data URLs. Pass max=1 for a single required shot, or omit it for a repeatable POD-style gallery. */
export function PhotoField({
  label,
  photos,
  onChange,
  max,
}: {
  label: BiValue;
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const atMax = max !== undefined && photos.length >= max;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(Array.from(files).map((f) => compressImageFile(f)));
      const next = max === 1 ? compressed.slice(0, 1) : [...photos, ...compressed].slice(0, max);
      onChange(next);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mb-3">
      <Bi value={label} mode="inline" className="text-xs font-semibold text-muted block mb-1.5" />
      <div className="flex flex-wrap gap-2">
        {photos.map((src, i) => (
          <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label="Remove photo"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {!atMax && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-16 h-16 rounded-xl border-2 border-dashed border-brand-tint text-brand flex items-center justify-center disabled:opacity-40"
          >
            <Camera size={20} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={max !== 1}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
