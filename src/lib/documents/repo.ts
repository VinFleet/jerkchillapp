import { supabase } from "@/lib/supabase/client";
import { getActiveTenant } from "@/lib/storage";
import {
  isAcceptedDocument,
  MAX_DOCUMENT_BYTES,
  type DocumentEntityType,
  type StoredDocument,
} from "./types";

/**
 * Certificates and paperwork, stored in Supabase rather than on the device.
 *
 * The deliberate exception to this app's local-first rule. A PDF is megabytes,
 * localStorage is a few and shared across every module, and a certificate
 * uploaded on the owner's laptop has to be visible on the kitchen tablet —
 * which local storage cannot do, since supplier records don't sync.
 *
 * So documents need a connection. That's acceptable because uploading a
 * supplier's certificate is an office task done once, not something anyone does
 * mid-service — and every other part of the app keeps working offline.
 */

// The branch this device is signed into — documents are per-branch like
// everything else.
const TENANT_ID = () => getActiveTenant();
const BUCKET = "documents";

/** Signed URLs are short-lived by design; long enough to open, not to share. */
const SIGNED_URL_TTL_SECONDS = 300;

export type DocumentResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "offline" | "not_configured" | "too_large" | "wrong_type" | "failed"; detail?: string };

type Row = {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  expires_on: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
};

function toDocument(row: Row): StoredDocument {
  return {
    id: row.id,
    entityType: row.entity_type as DocumentEntityType,
    entityId: row.entity_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    expiresOn: row.expires_on,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    notes: row.notes,
  };
}

export function documentsAvailable(): boolean {
  return Boolean(supabase);
}

export async function listDocuments(
  entityType: DocumentEntityType,
  entityId: string
): Promise<DocumentResult<StoredDocument[]>> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("tenant_id", TENANT_ID())
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      reason: navigator.onLine ? "failed" : "offline",
      detail: error.message,
    };
  }
  return { ok: true, value: (data as Row[]).map(toDocument) };
}

/**
 * A storage path that can't collide and doesn't leak the original filename.
 *
 * Filenames arrive with spaces, Vietnamese diacritics and occasionally slashes;
 * putting them in a path is how you get a 400 from Storage or an object in a
 * directory nobody expected. The real name is kept in the database row, which
 * is what the list actually displays.
 */
function storagePathFor(entityType: DocumentEntityType, entityId: string, file: File): string {
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin").toLowerCase();
  const unique = crypto.randomUUID();
  return `${entityType}/${entityId}/${unique}.${ext}`;
}

export async function uploadDocument(input: {
  entityType: DocumentEntityType;
  entityId: string;
  file: File;
  expiresOn?: string | null;
  uploadedBy?: string;
  notes?: string;
}): Promise<DocumentResult<StoredDocument>> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  if (!isAcceptedDocument(input.file)) return { ok: false, reason: "wrong_type" };
  if (input.file.size > MAX_DOCUMENT_BYTES) return { ok: false, reason: "too_large" };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, reason: "offline" };
  }

  const path = storagePathFor(input.entityType, input.entityId, input.file);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false });
  if (uploadError) {
    return { ok: false, reason: "failed", detail: uploadError.message };
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      tenant_id: TENANT_ID(),
      entity_type: input.entityType,
      entity_id: input.entityId,
      file_name: input.file.name,
      storage_path: path,
      mime_type: input.file.type || "application/octet-stream",
      size_bytes: input.file.size,
      expires_on: input.expiresOn || null,
      uploaded_by: input.uploadedBy ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    // The row is what makes the file findable, so a file with no row is
    // invisible clutter. Remove it rather than leave it orphaned.
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, reason: "failed", detail: error.message };
  }

  return { ok: true, value: toDocument(data as Row) };
}

/** A short-lived link to open or download the file. */
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Remove a document.
 *
 * Allowed, unlike a food-safety record: this is a copy of something that exists
 * elsewhere, and a certificate uploaded against the wrong supplier should be
 * fixable rather than permanent.
 */
export async function deleteDocument(doc: StoredDocument): Promise<DocumentResult<true>> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) return { ok: false, reason: "failed", detail: error.message };
  // Best-effort: the row is gone, so the file is already invisible to the app.
  await supabase.storage.from(BUCKET).remove([doc.storagePath]);
  return { ok: true, value: true };
}

/**
 * Documents lapsing soon, across every module.
 *
 * The point of storing an expiry on the document rather than only on the record
 * is that the reminder then comes from the thing that actually expires — a
 * separately-typed date drifts from the certificate it describes.
 */
export async function getExpiringDocuments(withinDays = 30): Promise<StoredDocument[]> {
  if (!supabase) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("tenant_id", TENANT_ID())
    .not("expires_on", "is", null)
    .lte("expires_on", cutoff.toISOString().slice(0, 10))
    .order("expires_on", { ascending: true });
  if (error || !data) return [];
  return (data as Row[]).map(toDocument);
}
