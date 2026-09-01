import { supabase } from "@/lib/supabase/client";
import { downscaleImage } from "@/lib/images/downscale";

/**
 * Menu photography.
 *
 * A public bucket, unlike documents. A certificate is answered with a
 * short-lived signed URL because only staff should see it; a menu photo has
 * to load on a guest's phone with no session at all, and a 300-second signed
 * URL would be expired before the second table scanned the code.
 *
 * Photos are downscaled in the browser before they leave the device. A phone
 * camera produces four megabytes for a tile that renders at about 300 pixels,
 * and eighteen of those over restaurant wifi is a menu that never finishes
 * loading — for the guest most of all, who is on 4G at a table.
 */

const BUCKET = "menu-photos";

/** Wide enough for a retina tile and the add-item header, no wider. */
const MAX_EDGE_PX = 900;
const JPEG_QUALITY = 0.82;

export type PhotoUploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; reason: "not_configured" | "too_large" | "not_an_image" | "failed"; detail?: string };

/** Refused before any resizing work, so a wrong file fails immediately. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;


export async function uploadMenuPhoto(menuItemId: string, file: File): Promise<PhotoUploadResult> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  if (!file.type.startsWith("image/")) return { ok: false, reason: "not_an_image" };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, reason: "too_large" };

  const body = await downscaleImage(file, MAX_EDGE_PX, JPEG_QUALITY);
  // Named for the item and stamped, so replacing a photo does not have to
  // race a cache and an old URL never silently becomes a different dish.
  const path = `${menuItemId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: "image/jpeg", upsert: false });
  if (error) return { ok: false, reason: "failed", detail: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}

/**
 * Remove a photo from storage.
 *
 * Best effort: the menu item has already stopped pointing at it, and a file
 * left behind costs a few kilobytes, while a failure here should not stop
 * someone replacing a bad photo.
 */
export async function deleteMenuPhoto(url: string): Promise<void> {
  if (!supabase) return;
  const marker = `/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return;
  const path = url.slice(at + marker.length).split("?")[0];
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * The branch's logo — same public bucket as the dish photos, because it has
 * the same audience: the app chrome, the guest page, the printed bill.
 * Scoped under the tenant so two restaurants' logos can never collide.
 */
export async function uploadBrandLogo(
  tenantId: string,
  file: File
): Promise<PhotoUploadResult> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  if (!file.type.startsWith("image/")) return { ok: false, reason: "not_an_image" };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, reason: "too_large" };

  const body = await downscaleImage(file, 600, 0.9);
  const path = `branding/${tenantId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: "image/jpeg", upsert: false });
  if (error) return { ok: false, reason: "failed", detail: error.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}
