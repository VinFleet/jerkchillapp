"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { useSession } from "@/lib/auth/RoleContext";
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
  documentsAvailable,
} from "@/lib/documents/repo";
import {
  DOCUMENT_ACCEPT_ATTR,
  formatBytes,
  type DocumentEntityType,
  type StoredDocument,
} from "@/lib/documents/types";

/**
 * Attach the actual paperwork to a supplier, a staff health record or a licence.
 *
 * Certificates were previously recorded as a tick and an expiry date, which is
 * worth nothing at an inspection if the document itself is in a drawer at
 * someone's house. This puts the file where the record is.
 *
 * Readable by every signed-in station on purpose: a chef taking a delivery may
 * want to check the supplier's food-safety certificate hasn't lapsed, and
 * hiding it from them helps nobody.
 */
export function DocumentUploader({
  entityType,
  entityId,
  title,
  hint,
  /** Offer an expiry date on upload — right for certificates, noise for invoices. */
  withExpiry = true,
  canDelete = true,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  title: { en: string; vi: string };
  hint?: { en: string; vi: string };
  withExpiry?: boolean;
  canDelete?: boolean;
}) {
  const { session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expiresOn, setExpiresOn] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listDocuments(entityType, entityId);
    setDocs(result.ok ? result.value : []);
    if (!result.ok && result.reason === "offline") {
      setMessage("Offline — documents need a connection. · Ngoại tuyến — cần kết nối để xem hồ sơ.");
    }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const result = await uploadDocument({
      entityType,
      entityId,
      file,
      expiresOn: withExpiry && expiresOn ? expiresOn : null,
      uploadedBy: session?.name || undefined,
    });
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";

    if (result.ok) {
      setExpiresOn("");
      setMessage(null);
      await refresh();
      return;
    }
    setMessage(
      {
        offline: "You're offline — try again once there's a connection. · Đang ngoại tuyến — thử lại khi có mạng.",
        not_configured: "Uploads aren't set up yet — ask the owner. · Chưa cài đặt tải lên.",
        too_large: "That file is bigger than 10 MB. Photograph or scan it smaller. · Tệp lớn hơn 10 MB.",
        wrong_type: "Only PDF or a photo (JPG, PNG, HEIC). · Chỉ nhận PDF hoặc ảnh.",
        failed: `Upload failed. ${result.detail ?? ""}`,
      }[result.reason]
    );
  };

  const open = async (doc: StoredDocument) => {
    const url = await getDocumentUrl(doc.storagePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setMessage("Couldn't open that file. · Không mở được tệp.");
  };

  const remove = async (doc: StoredDocument) => {
    setBusy(true);
    const result = await deleteDocument(doc);
    setBusy(false);
    if (!result.ok) setMessage("Couldn't remove that file. · Không xóa được tệp.");
    await refresh();
  };

  if (!documentsAvailable()) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <p className="font-semibold text-sm">{title.en}</p>
      <p className="text-xs text-muted mb-1">{title.vi}</p>
      {hint && (
        <p className="text-xs text-muted mb-2">
          {hint.en}
          <br />
          {hint.vi}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-muted py-2">Loading… · Đang tải…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted py-2">
          Nothing uploaded yet · Chưa có tệp nào
        </p>
      ) : (
        <ul className="space-y-2 my-2">
          {docs.map((doc) => {
            const expired = doc.expiresOn !== null && doc.expiresOn < today;
            return (
              <li
                key={doc.id}
                className={`rounded-2xl border-2 p-3 ${expired ? "border-danger" : "border-border"}`}
              >
                <div className="flex items-start gap-2">
                  {doc.mimeType === "application/pdf" ? (
                    <FileText size={18} className="text-brand shrink-0 mt-0.5" />
                  ) : (
                    <ImageIcon size={18} className="text-brand shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold break-words">{doc.fileName}</p>
                    <p className="text-xs text-muted">
                      {formatBytes(doc.sizeBytes)}
                      {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                      {` · ${new Date(doc.uploadedAt).toLocaleDateString("en-GB")}`}
                    </p>
                    {doc.expiresOn && (
                      <p className={`text-xs font-semibold mt-0.5 ${expired ? "text-danger" : "text-muted"}`}>
                        {expired ? "Expired · Đã hết hạn " : "Expires · Hết hạn "}
                        {new Date(doc.expiresOn).toLocaleDateString("en-GB")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => void open(doc)}
                    className="min-h-11 flex items-center gap-1.5 text-sm text-brand font-semibold"
                  >
                    <ExternalLink size={14} /> Open · Mở
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => void remove(doc)}
                      disabled={busy}
                      className="min-h-11 flex items-center gap-1.5 text-sm text-danger font-semibold"
                    >
                      <Trash2 size={14} /> Remove · Xóa
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {withExpiry && (
        <label className="block mb-2">
          <span className="text-xs text-muted">Expiry date, if it has one · Ngày hết hạn (nếu có)</span>
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm mt-1"
          />
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="min-h-12 w-full rounded-2xl border-2 border-brand text-brand font-semibold text-sm flex items-center justify-center gap-2 active:bg-brand-light disabled:opacity-60"
      >
        <Upload size={16} />
        {busy ? "Uploading… · Đang tải lên…" : "Upload a file · Tải tệp lên"}
      </button>
      <p className="text-[11px] text-muted mt-1.5 text-center">
        PDF or a photo, up to 10 MB · PDF hoặc ảnh, tối đa 10 MB
      </p>

      {message && (
        <p className="text-sm text-danger font-semibold mt-2 flex items-start gap-1.5">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
