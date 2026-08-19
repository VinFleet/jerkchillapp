"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import type { Bi as BiValue, PhotoRef } from "@/lib/types";
import { Bi } from "@/components/Bi";
import { captureFullAndThumb } from "@/lib/imageCapture";
import { addPendingPhoto, newPhotoId, clearPendingPhoto } from "@/lib/photos/store";

/**
 * Photo capture via the phone camera (or file picker on desktop).
 *
 * The small preview goes into the record; the full-resolution copy is held on
 * this device until it reaches Supabase Storage. Pass max=1 for a single
 * required shot, or omit it for a repeatable proof-of-delivery gallery.
 */
export function PhotoField({
  label,
  photos,
  onChange,
  max,
  context,
}: {
  label: BiValue;
  photos: PhotoRef[];
  onChange: (photos: PhotoRef[]) => void;
  max?: number;
  /** what these photos belong to, so a stuck upload can be traced back */
  context: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const atMax = max !== undefined && photos.length >= max;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const refs: PhotoRef[] = [];
      for (const file of Array.from(files)) {
        const { full, thumb } = await captureFullAndThumb(file);
        const id = newPhotoId();
        addPendingPhoto(id, full, context);
        refs.push({ id, thumb });
      }
      const next = max === 1 ? refs.slice(0, 1) : [...photos, ...refs].slice(0, max);
      onChange(next);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (photo: PhotoRef) => {
    // Only safe before the record is saved — an unsaved photo has no record to
    // be evidence for. Once filed, neither the app nor the bucket allows it.
    clearPendingPhoto(photo.id);
    onChange(photos.filter((p) => p.id !== photo.id));
  };

  return (
    <div className="mb-3">
      <Bi value={label} mode="inline" className="text-xs font-semibold text-muted block mb-1.5" />
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.thumb} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(photo)}
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
            aria-label="Take photo"
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
