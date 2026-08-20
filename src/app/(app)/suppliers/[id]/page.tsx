"use client";

import { useEffect, useState, use as usePromise } from "react";
import { Phone, Mail, Globe, Pencil, Check } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canManageSuppliers } from "@/lib/auth/permissions";
import { getSupplier, updateSupplier, getRejections, getEvaluations, toggleSupplierDocItem } from "@/lib/repo/suppliers";
import { getContactForSupplier, addContact, updateContact } from "@/lib/repo/contacts";
import { SUPPLIER_CATEGORY_LABEL, SUPPLIER_STATUS_LABEL, SUPPLIER_STATUS_TONE, EVALUATION_DECISION_LABEL } from "@/lib/supplierLabels";
import type { Supplier, Contact, RejectionRecord, SupplierEvaluation } from "@/lib/types";

function ContactSection({ supplier, canEdit, onChanged }: { supplier: Supplier; canEdit: boolean; onChanged: () => void }) {
  const [contact, setContact] = useState<Contact | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  const refresh = () => {
    const c = getContactForSupplier(supplier.id, supplier.contactId);
    setContact(c);
    setPhone(c?.phone ?? "");
    setEmail(c?.email ?? "");
    setWebsite(c?.website ?? "");
  };

  useEffect(refresh, [supplier.id, supplier.contactId]);

  const save = () => {
    if (contact) {
      updateContact(contact.id, {
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
      });
    } else {
      const created = addContact({
        category: "supplier",
        name: supplier.name,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        linkedSupplierId: supplier.id,
      });
      updateSupplier(supplier.id, { contactId: created.id });
    }
    setEditing(false);
    refresh();
    onChanged();
  };

  if (editing) {
    return (
      <Card className="mb-4">
        <p className="font-semibold text-sm mb-2">Contact details · Thông tin liên hệ</p>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
                inputMode="tel"
                placeholder="Phone · Số điện thoại"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
        />
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="Website"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
        />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setEditing(false)}>
            Cancel · Hủy
          </Button>
          <Button className="flex-1" onClick={save}>
            Save · Lưu
          </Button>
        </div>
      </Card>
    );
  }

  const hasAny = contact?.phone || contact?.email || contact?.website;

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">Contact details · Thông tin liên hệ</p>
        {canEdit && (
          <button onClick={() => setEditing(true)} className="text-brand" aria-label="Edit contact details">
            <Pencil size={16} />
          </button>
        )}
      </div>
      {hasAny ? (
        <div className="space-y-2">
          {contact?.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-3 text-sm">
              <span className="w-11 h-11 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
                <Phone size={16} />
              </span>
              {contact.phone}
            </a>
          )}
          {contact?.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-sm">
              <span className="w-11 h-11 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
                <Mail size={16} />
              </span>
              {contact.email}
            </a>
          )}
          {contact?.website && (
            <a
              href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm"
            >
              <span className="w-11 h-11 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
                <Globe size={16} />
              </span>
              {contact.website}
            </a>
          )}
        </div>
      ) : (
        <p className="text-muted text-sm">
          {canEdit ? "No contact details yet — tap to add · Chưa có thông tin — chạm để thêm" : "No contact details on file · Chưa có thông tin liên hệ"}
        </p>
      )}
    </Card>
  );
}

function CertsSection({ supplier, canEdit, onChanged }: { supplier: Supplier; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [businessRegNo, setBusinessRegNo] = useState(supplier.businessRegNo ?? "");
  const [regOnFile, setRegOnFile] = useState(supplier.regOnFile ?? false);
  const [certExpiry, setCertExpiry] = useState(supplier.foodSafetyCertExpiry ?? "");
  const [otherCerts, setOtherCerts] = useState(supplier.otherCerts ?? "");

  if (editing) {
    return (
      <Card className="mb-4">
        <p className="font-semibold text-sm mb-2">Certifications · Chứng nhận</p>
        <label className="text-xs text-muted">Business registration No. · Số ĐKKD</label>
        <input
          value={businessRegNo}
          onChange={(e) => setBusinessRegNo(e.target.value)}
          placeholder="e.g. 0315000500 — issued 19 Apr 2018, Dept. of Planning & Investment, HCMC"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 mt-1 text-sm focus:outline-none focus:border-brand"
        />
        <button
          onClick={() => setRegOnFile((v) => !v)}
          className={`w-full min-h-11 rounded-xl border-2 font-semibold text-sm mb-3 ${
            regOnFile ? "bg-brand text-white border-brand" : "border-border text-muted"
          }`}
        >
          {regOnFile ? "✓ Registration on file · Có ĐKKD" : "Registration on file? · Có ĐKKD?"}
        </button>
        <label className="text-xs text-muted">Food safety cert expiry · Ngày hết hạn ATTP</label>
        <input
          type="date"
          value={certExpiry}
          onChange={(e) => setCertExpiry(e.target.value)}
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 mt-1 text-sm focus:outline-none focus:border-brand"
        />
        <label className="text-xs text-muted">Other certs · Chứng nhận khác</label>
        <input
          value={otherCerts}
          onChange={(e) => setOtherCerts(e.target.value)}
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 mt-1 text-sm focus:outline-none focus:border-brand"
        />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setEditing(false)}>
            Cancel · Hủy
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              updateSupplier(supplier.id, {
                businessRegNo: businessRegNo.trim() || undefined,
                regOnFile,
                foodSafetyCertExpiry: certExpiry.trim() || undefined,
                otherCerts: otherCerts.trim() || undefined,
              });
              setEditing(false);
              onChanged();
            }}
          >
            Save · Lưu
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">Certifications · Chứng nhận</p>
        {canEdit && (
          <button onClick={() => setEditing(true)} className="text-brand" aria-label="Edit certifications">
            <Pencil size={16} />
          </button>
        )}
      </div>
      <p className="text-sm">
        {supplier.regOnFile
          ? `Registration on file${supplier.businessRegNo ? ` — ${supplier.businessRegNo}` : ""}`
          : "Registration not yet on file · Chưa có ĐKKD trong hồ sơ"}
      </p>
      <p className="text-sm mt-2">
        {supplier.foodSafetyCertExpiry
          ? `Food safety cert expires ${supplier.foodSafetyCertExpiry}`
          : "No food safety cert expiry on file · Chưa có ngày hết hạn ATTP"}
      </p>
      {supplier.otherCerts && <p className="text-sm text-muted mt-1">{supplier.otherCerts}</p>}
      {supplier.lastReviewed && <p className="text-xs text-muted mt-2">Last reviewed {supplier.lastReviewed}</p>}
    </Card>
  );
}

function DocumentChecklistSection({ supplier, canEdit, onChanged }: { supplier: Supplier; canEdit: boolean; onChanged: () => void }) {
  if (!supplier.documentChecklist || supplier.documentChecklist.length === 0) return null;
  const done = supplier.documentChecklist.filter((d) => d.checked).length;

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">Paperwork to collect · Giấy tờ cần thu thập</p>
        <Badge tone={done === supplier.documentChecklist.length ? "success" : "muted"}>
          {done}/{supplier.documentChecklist.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {supplier.documentChecklist.map((item, i) => (
          <button
            key={i}
            disabled={!canEdit}
            onClick={() => {
              toggleSupplierDocItem(supplier.id, i);
              onChanged();
            }}
            className="w-full flex items-start gap-3 text-left disabled:opacity-90"
          >
            <span
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                item.checked ? "bg-brand border-brand text-white" : "border-border"
              }`}
            >
              {item.checked && <Check size={14} />}
            </span>
            <span>
              <span className="block text-sm">{item.label.en}</span>
              <span className="block text-xs text-muted">{item.label.vi}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function HistorySection({ supplierId }: { supplierId: string }) {
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  const [evaluations, setEvaluations] = useState<SupplierEvaluation[]>([]);

  useEffect(() => {
    setRejections(getRejections(supplierId));
    setEvaluations(getEvaluations(supplierId));
  }, [supplierId]);

  if (rejections.length === 0 && evaluations.length === 0) return null;

  return (
    <>
      {evaluations.length > 0 && (
        <Card className="mb-4">
          <p className="font-semibold text-sm mb-2">Evaluations · Đánh giá</p>
          <div className="space-y-2">
            {evaluations.map((e) => (
              <div key={e.id} className="pb-2 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{e.period}</p>
                  <Badge tone={e.decision === "continue" ? "success" : e.decision === "review" ? "warning" : "danger"}>{EVALUATION_DECISION_LABEL[e.decision].en} · {EVALUATION_DECISION_LABEL[e.decision].vi}</Badge>
                </div>
                <p className="text-xs text-muted">
                  Quality {e.qualityScore}/5 · On-time {e.onTimeScore}/5 · Docs {e.docsOk ? "OK" : "Not OK"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {rejections.length > 0 && (
        <Card className="mb-4">
          <p className="font-semibold text-sm mb-2">Rejections · Từ chối hàng</p>
          <div className="space-y-2">
            {rejections.map((r) => (
              <div key={r.id} className="pb-2 border-b border-border last:border-0 last:pb-0">
                <p className="text-xs text-muted">
                  {r.date} · {r.loggedBy}
                </p>
                <p className="text-sm">{r.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function SupplierDetailContent({ id }: { id: string }) {
  const { session } = useSession();
  const [supplier, setSupplier] = useState<Supplier | null | undefined>(undefined);
  const [, setTick] = useState(0);

  useEffect(() => {
    setSupplier(getSupplier(id) ?? null);
  }, [id]);

  if (!session || supplier === undefined) return null;
  if (supplier === null) {
    return <div className="p-6 text-center text-muted">Supplier not found · Không tìm thấy nhà cung cấp</div>;
  }

  const canEdit = canManageSuppliers(session.role);
  const refresh = () => {
    setSupplier(getSupplier(id) ?? null);
    setTick((t) => t + 1);
  };

  return (
    <div className="pb-10">
      <BackLink href="/suppliers" label="Suppliers · Nhà cung cấp" />
      <PageHeader
        title={supplier.name}
        subtitle={`${SUPPLIER_CATEGORY_LABEL[supplier.category].en} · ${SUPPLIER_CATEGORY_LABEL[supplier.category].vi}`}
        action={<Badge tone={SUPPLIER_STATUS_TONE[supplier.status]}>{SUPPLIER_STATUS_LABEL[supplier.status].en} · {SUPPLIER_STATUS_LABEL[supplier.status].vi}</Badge>}
      />
      <div className="px-4 md:px-8 mt-2">
        <ContactSection supplier={supplier} canEdit={canEdit} onChanged={refresh} />
        <CertsSection supplier={supplier} canEdit={canEdit} onChanged={refresh} />
        <DocumentChecklistSection supplier={supplier} canEdit={canEdit} onChanged={refresh} />
        <HistorySection supplierId={supplier.id} />
      </div>
    </div>
  );
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  return (
    <RoleGate module="suppliers">
      <SupplierDetailContent id={id} />
    </RoleGate>
  );
}
