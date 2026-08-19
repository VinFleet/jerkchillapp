import { readList, writeList, newId } from "@/lib/storage";

/**
 * Full-resolution photo bytes waiting to reach Supabase Storage.
 *
 * Deliberately kept out of the record itself and out of sync: this is the
 * one copy of a piece of legal evidence until the upload is confirmed, so it
 * lives on the device that took it and is deleted only once the server has
 * acknowledged the object. Nothing here is ever dropped to save space.
 */
export type PendingPhoto = {
  id: string;
  /** full-resolution JPEG data URL */
  dataUrl: string;
  /** what it belongs to, so a failed upload can be traced back to a record */
  context: string;
  createdAt: string;
};

const PENDING_KEY = "photo_pending";

export function newPhotoId(): string {
  return newId("photo");
}

export function getPendingPhotos(): PendingPhoto[] {
  return readList<PendingPhoto>(PENDING_KEY);
}

export function getPendingPhoto(id: string): PendingPhoto | undefined {
  return getPendingPhotos().find((p) => p.id === id);
}

export function addPendingPhoto(id: string, dataUrl: string, context: string): void {
  const all = getPendingPhotos();
  if (all.some((p) => p.id === id)) return;
  all.push({ id, dataUrl, context, createdAt: new Date().toISOString() });
  writeList(PENDING_KEY, all);
}

/** Only ever called after Storage has confirmed the object exists. */
export function clearPendingPhoto(id: string): void {
  writeList(
    PENDING_KEY,
    getPendingPhotos().filter((p) => p.id !== id)
  );
}

export function pendingPhotoCount(): number {
  return getPendingPhotos().length;
}

/** Total bytes still held on this device — what moves off once uploads succeed. */
export function pendingPhotoBytes(): number {
  return getPendingPhotos().reduce((sum, p) => sum + Math.floor((p.dataUrl.length * 3) / 4), 0);
}
