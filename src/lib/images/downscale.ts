/**
 * Shrink a photo before it leaves the device.
 *
 * A phone camera produces four megabytes for something that renders at a few
 * hundred pixels. Over restaurant wifi, mid-service, that is the difference
 * between an upload that finishes and one a waiter gives up on.
 *
 * Returns the original if anything goes wrong. A photo that uploads large is
 * slow; a photo that fails to upload does not exist.
 */
export async function downscaleImage(
  file: File,
  maxEdgePx: number,
  quality = 0.82
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdgePx / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg") return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
