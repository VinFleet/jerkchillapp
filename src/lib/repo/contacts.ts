import type { Contact, ContactCategory } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, isLegacyTenant } from "@/lib/storage";
import { SEED_CONTACTS } from "@/lib/seed/contacts";

const CONTACTS_KEY = "contacts";
const KAMEREO_ENRICH_KEY = "contacts_kamereo_enrich_v1";

export function ensureContactsSeeded() {
  // A neutral branch keeps only what is true everywhere in Vietnam: the
  // national emergency numbers. Jerk & Chill's suppliers, landlord and staff
  // numbers are customer number one's phone book, not a template.
  if (!isLegacyTenant()) {
    if (!isSeeded(CONTACTS_KEY)) {
      writeList(CONTACTS_KEY, SEED_CONTACTS.filter((c) => c.category === "emergency"));
      markSeeded(CONTACTS_KEY);
    }
    markSeeded(KAMEREO_ENRICH_KEY);
    return;
  }
  if (!isSeeded(CONTACTS_KEY)) {
    writeList(CONTACTS_KEY, SEED_CONTACTS);
    markSeeded(CONTACTS_KEY);
    markSeeded(KAMEREO_ENRICH_KEY);
    return;
  }
  // One-time enrichment for browsers seeded before Kamereo's real contact
  // details (Food Safety Book Section 3.3) were available. Only fills in
  // fields the user hasn't already set themselves — never overwrites a real
  // edit — and never runs more than once.
  if (!isSeeded(KAMEREO_ENRICH_KEY)) {
    const all = readList<Contact>(CONTACTS_KEY);
    const idx = all.findIndex((c) => c.id === "ct_kamereo");
    const seedKamereo = SEED_CONTACTS.find((c) => c.id === "ct_kamereo");
    if (idx >= 0 && seedKamereo && !all[idx].phone) {
      all[idx] = { ...all[idx], ...seedKamereo };
      writeList(CONTACTS_KEY, all);
    }
    markSeeded(KAMEREO_ENRICH_KEY);
  }
}

export function getContacts(category?: ContactCategory): Contact[] {
  const all = readList<Contact>(CONTACTS_KEY);
  return category ? all.filter((c) => c.category === category) : all;
}

export function getContact(id: string): Contact | undefined {
  return getContacts().find((c) => c.id === id);
}

/** Seed data links suppliers to contacts from both sides (Supplier.contactId and Contact.linkedSupplierId) — check both. */
export function getContactForSupplier(supplierId: string, supplierContactId?: string): Contact | undefined {
  const all = getContacts();
  if (supplierContactId) {
    const byId = all.find((c) => c.id === supplierContactId);
    if (byId) return byId;
  }
  return all.find((c) => c.linkedSupplierId === supplierId);
}

export function addContact(input: Omit<Contact, "id">): Contact {
  const entry: Contact = { ...input, id: newId("contact") };
  const all = getContacts();
  all.push(entry);
  writeList(CONTACTS_KEY, all);
  return entry;
}

export function updateContact(id: string, patch: Partial<Omit<Contact, "id">>) {
  const all = getContacts();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(CONTACTS_KEY, all);
}

export function removeContact(id: string) {
  writeList(
    CONTACTS_KEY,
    getContacts().filter((c) => c.id !== id)
  );
}
