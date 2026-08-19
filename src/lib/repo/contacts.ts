import type { Contact, ContactCategory } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId } from "@/lib/storage";
import { SEED_CONTACTS } from "@/lib/seed/contacts";

const CONTACTS_KEY = "contacts";

export function ensureContactsSeeded() {
  if (isSeeded(CONTACTS_KEY)) return;
  writeList(CONTACTS_KEY, SEED_CONTACTS);
  markSeeded(CONTACTS_KEY);
}

export function getContacts(category?: ContactCategory): Contact[] {
  const all = readList<Contact>(CONTACTS_KEY);
  return category ? all.filter((c) => c.category === category) : all;
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
