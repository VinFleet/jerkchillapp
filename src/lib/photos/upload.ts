import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { getActiveTenant, readList, writeList } from "@/lib/storage";
import { getPendingPhotos, clearPendingPhoto } from "@/lib/photos/store";
import type { DeliveryLog, PhotoRef } from "@/lib/types";

const BUCKET = "delivery-photos";
const DELIVERY_KEY = "fs_delivery_logs";
/** Signed URLs are short-lived by design — these are compliance records, not public assets. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/** Sets `path` on whichever delivery record owns this photo, so the app knows the upload landed. */
function markUploaded(photoId: string, path: string): boolean {
  const logs = readList<DeliveryLog>(DELIVERY_KEY);
  let changed = false;

  const patch = (ref: PhotoRef | undefined): PhotoRef | undefined => {
    if (!ref || ref.id !== photoId || ref.path) return ref;
    changed = true;
    return { ...ref, path };
  };

  const next = logs.map((log) => ({
    ...log,
    invoicePhotoRef: patch(log.invoicePhotoRef),
    productPhotoRefs: log.productPhotoRefs?.map((r) => patch(r) as PhotoRef),
  }));

  if (changed) writeList(DELIVERY_KEY, next);
  return changed;
}

export type UploadResult = { uploaded: number; failed: number; remaining: number };

/**
 * Moves pending full-resolution photos to Storage.
 *
 * Order matters: the local copy is deleted only after the object exists and
 * the owning record has been updated. If anything fails the bytes stay put
 * and the next attempt retries — a photo of a rejected delivery is evidence,
 * and losing it to a flaky connection is not an acceptable outcome.
 */
export async function uploadPendingPhotos(): Promise<UploadResult> {
  const pending = getPendingPhotos();
  if (!supabaseConfigured || !supabase || pending.length === 0) {
    return { uploaded: 0, failed: 0, remaining: pending.length };
  }

  const tenant = getActiveTenant();
  let uploaded = 0;
  let failed = 0;

  for (const photo of pending) {
    const path = `${tenant}/${photo.id}.jpg`;
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(path, dataUrlToBlob(photo.dataUrl), {
        contentType: "image/jpeg",
        // The bucket has no update policy — an already-filed photo must not be
        // replaceable. A duplicate id means it's already there, which is fine.
        upsert: false,
      });
      const alreadyThere = error?.message?.toLowerCase().includes("exists");
      if (error && !alreadyThere) throw error;

      markUploaded(photo.id, path);
      clearPendingPhoto(photo.id);
      uploaded++;
    } catch {
      failed++;
    }
  }

  return { uploaded, failed, remaining: getPendingPhotos().length };
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** Short-lived signed URL for a stored photo, cached until shortly before it expires. */
export async function getPhotoUrl(path: string): Promise<string | null> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000,
  });
  return data.signedUrl;
}

/**
 * One-time migration of records written before photos moved to Storage.
 * The inline base64 becomes the preview and the pending full-resolution copy,
 * so an older delivery ends up on exactly the same footing as a new one —
 * nothing is discarded, and the bytes only leave the device once uploaded.
 */
export function migrateLegacyDeliveryPhotos(
  addPending: (id: string, dataUrl: string, context: string) => void,
  newPhotoId: () => string
): number {
  const logs = readList<DeliveryLog>(DELIVERY_KEY);
  let migrated = 0;

  const next = logs.map((log) => {
    if (!log.invoicePhoto && !(log.productPhotos && log.productPhotos.length > 0)) return log;
    const updated: DeliveryLog = { ...log };

    if (log.invoicePhoto && !log.invoicePhotoRef) {
      const id = newPhotoId();
      addPending(id, log.invoicePhoto, `delivery ${log.id} invoice`);
      updated.invoicePhotoRef = { id, thumb: log.invoicePhoto };
      migrated++;
    }
    if (log.productPhotos?.length && !log.productPhotoRefs) {
      updated.productPhotoRefs = log.productPhotos.map((dataUrl) => {
        const id = newPhotoId();
        addPending(id, dataUrl, `delivery ${log.id} product`);
        migrated++;
        return { id, thumb: dataUrl };
      });
    }

    delete updated.invoicePhoto;
    delete updated.productPhotos;
    return updated;
  });

  if (migrated > 0) writeList(DELIVERY_KEY, next);
  return migrated;
}
