// Downscales and compresses a captured photo to a JPEG data URL. A raw phone
// camera photo can be several MB; the full-resolution copy goes to Supabase
// Storage and only a small preview stays in the record.
export function compressImageFile(file: File, maxDim = 1280, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Preview size that lives inside the record — legible at a glance, ~10-20KB. */
export const THUMB_MAX_DIM = 320;
export const THUMB_QUALITY = 0.5;

/**
 * Produces both sizes in one pass over the file: the full-resolution copy
 * destined for Storage, and the small preview that stays in the record so
 * every device can see the evidence offline.
 */
export async function captureFullAndThumb(file: File): Promise<{ full: string; thumb: string }> {
  const [full, thumb] = await Promise.all([
    compressImageFile(file),
    compressImageFile(file, THUMB_MAX_DIM, THUMB_QUALITY),
  ]);
  return { full, thumb };
}

/** Rough byte size of a data URL, for logging and quota decisions. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}
