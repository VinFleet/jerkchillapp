import type { Bi } from "@/lib/types";

/**
 * What a document can be attached to.
 *
 * Kept as a closed union rather than a free string so a typo can't silently
 * orphan a certificate against an entity nothing ever queries.
 */
export type DocumentEntityType = "supplier" | "staff_health" | "license";

export const DOCUMENT_ENTITY_LABEL: Record<DocumentEntityType, Bi> = {
  supplier: { en: "Supplier document", vi: "Hồ sơ nhà cung cấp" },
  staff_health: { en: "Health certificate", vi: "Giấy khám sức khỏe" },
  license: { en: "Licence or certificate", vi: "Giấy phép / chứng nhận" },
};

export type StoredDocument = {
  id: string;
  entityType: DocumentEntityType;
  entityId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  /** Certificates expire; the reminder should come from the document itself. */
  expiresOn: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  notes: string | null;
};

/** 10 MB — a scan or a phone photo of a certificate, not a video. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
];

/** What the file picker offers. HEIC matters — it's what an iPhone produces. */
export const DOCUMENT_ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.heic,.webp,application/pdf,image/*";

export function isAcceptedDocument(file: { type: string; name: string }): boolean {
  if (ACCEPTED_DOCUMENT_TYPES.includes(file.type)) return true;
  // Some browsers report an empty type for HEIC and for files picked from
  // certain cloud providers, so fall back to the extension rather than
  // rejecting a valid certificate.
  return /\.(pdf|jpe?g|png|heic|webp)$/i.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
