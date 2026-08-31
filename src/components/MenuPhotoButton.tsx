"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, X } from "lucide-react";
import { uploadMenuPhoto, deleteMenuPhoto } from "@/lib/menu/photos";
import { setMenuItemImage } from "@/lib/repo/menu";
import type { MenuItem } from "@/lib/types";

/**
 * The photo on a menu item.
 *
 * Doubles as its own preview, so the thing you tap to change the picture is
 * the picture — there is no separate "upload" affordance to find. Accepts a
 * camera capture as readily as a file, because the photo that ends up on the
 * menu is usually taken standing over the plate.
 */
export function MenuPhotoButton({
  item,
  onChange,
}: {
  item: MenuItem;
  onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(null);

    const result = await uploadMenuPhoto(item.id, file);
    if (result.ok) {
      // The old file goes only once the new one is safely up, so a failed
      // replacement leaves the item with the photo it already had.
      const previous = item.imageUrl;
      setMenuItemImage(item.id, result.url);
      if (previous) void deleteMenuPhoto(previous);
      onChange();
    } else {
      setProblem(
        result.reason === "not_an_image"
          ? "That's not an image · Tệp không phải ảnh"
          : result.reason === "too_large"
            ? "That photo is too big · Ảnh quá lớn"
            : result.reason === "not_configured"
              ? "Photos need a connection · Cần kết nối mạng"
              : `Upload failed · Tải lên thất bại${result.detail ? ` — ${result.detail}` : ""}`
      );
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  const remove = () => {
    const previous = item.imageUrl;
    setMenuItemImage(item.id, null);
    if (previous) void deleteMenuPhoto(previous);
    onChange();
  };

  return (
    <div className="shrink-0">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="relative">
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={item.imageUrl ? "Replace the photo" : "Add a photo"}
          className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-brand-light grid place-items-center relative"
        >
          {busy ? (
            <Loader2 size={20} className="animate-spin text-muted" />
          ) : item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              width={64}
              height={64}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <Camera size={20} className="text-brand/60" />
          )}
        </button>
        {item.imageUrl && !busy && (
          <button
            onClick={remove}
            aria-label="Remove the photo"
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-surface border border-border grid place-items-center text-muted"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {problem && <p className="text-[11px] text-warning mt-1 max-w-[120px]">{problem}</p>}
    </div>
  );
}
