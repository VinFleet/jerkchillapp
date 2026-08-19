"use client";

import { useEffect, useState } from "react";
import { Plus, Phone, Mail } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditContacts } from "@/lib/auth/permissions";
import { getContacts, addContact } from "@/lib/repo/contacts";
import { CONTACT_CATEGORY_LABEL, CONTACT_CATEGORY_ORDER } from "@/lib/contactLabels";
import type { Contact, ContactCategory } from "@/lib/types";

function AddContactForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ContactCategory>("staff");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add contact · Thêm liên hệ
      </button>
    );
  }

  const reset = () => {
    setName("");
    setRole("");
    setPhone("");
    setEmail("");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New contact · Liên hệ mới</p>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as ContactCategory)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm bg-surface focus:outline-none focus:border-brand"
      >
        {CONTACT_CATEGORY_ORDER.map((c) => (
          <option key={c} value={c}>
            {CONTACT_CATEGORY_LABEL[c].en} · {CONTACT_CATEGORY_LABEL[c].vi}
          </option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name · Tên"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role / relation (optional) · Vai trò"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone · Số điện thoại"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            addContact({
              category,
              name: name.trim(),
              role: role.trim() || undefined,
              phone: phone.trim() || undefined,
              email: email.trim() || undefined,
            });
            reset();
            onAdded();
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{contact.name}</p>
        {contact.role && <p className="text-xs text-muted truncate">{contact.role}</p>}
        {contact.notes && <p className="text-xs text-muted truncate">{contact.notes}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="w-11 h-11 rounded-xl bg-brand-light text-brand flex items-center justify-center"
            aria-label="Call"
          >
            <Phone size={18} />
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="w-11 h-11 rounded-xl bg-brand-light text-brand flex items-center justify-center"
            aria-label="Email"
          >
            <Mail size={18} />
          </a>
        )}
      </div>
    </Card>
  );
}

function ContactsContent() {
  const { session } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const refresh = () => setContacts(getContacts());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;
  const canEdit = canEditContacts(session.role);

  return (
    <div className="pb-6">
      <PageHeader title="Contacts Directory · Danh Bạ Liên Hệ" subtitle="Suppliers, staff, emergency, building · NCC, nhân viên, khẩn cấp, tòa nhà" />
      <div className="px-4 md:px-8">
        {canEdit && <AddContactForm onAdded={refresh} />}
        {CONTACT_CATEGORY_ORDER.map((category) => {
          const items = contacts.filter((c) => c.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-5">
              <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">
                <Bi value={CONTACT_CATEGORY_LABEL[category]} mode="inline" />
              </h2>
              <div className="space-y-2">
                {items.map((c) => (
                  <ContactCard key={c.id} contact={c} />
                ))}
              </div>
            </div>
          );
        })}
        {contacts.length === 0 && <p className="text-muted text-center py-10 text-sm">No contacts yet · Chưa có liên hệ nào</p>}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <RoleGate module="contacts">
      <ContactsContent />
    </RoleGate>
  );
}
