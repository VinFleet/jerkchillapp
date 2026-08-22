-- Jerk & Chill — document and certificate attachments
--
-- HOW TO RUN THIS:
-- 1. Open your Supabase project at supabase.com/dashboard
-- 2. Go to SQL Editor -> New query
-- 3. Paste this whole file and click Run
--
-- Safe to re-run — every statement is idempotent.
--
-- WHAT THIS IS FOR
-- The actual paperwork: a supplier's food-safety certificate, a staff health
-- certificate, the Certificate of Eligibility for Food Safety, PCCC fire
-- safety, a pest-control contract. Until now the app recorded that these
-- existed and when they expired, but not the documents themselves — and at an
-- inspection a tick-box saying "on file" is worth nothing if the file is in a
-- drawer in someone's house.
--
-- WHY THESE LIVE IN POSTGRES RATHER THAN LOCALSTORAGE
-- Everything else in this app is local-first, because service must continue on
-- bad wifi. Documents are the deliberate exception:
--
--   * a PDF is megabytes; localStorage is a few, shared across every module
--   * uploading a supplier's certificate is an office task done once, by the
--     owner, not something a chef does mid-service
--   * a document uploaded on the owner's laptop has to be visible on the
--     kitchen tablet, and supplier records themselves do not sync
--
-- So documents need a connection. Everything else keeps working without one.

create table if not exists documents (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null default 'jerk-and-chill-thao-dien',
  -- what this document belongs to: 'supplier' | 'staff_health' | 'license'
  entity_type  text        not null,
  -- the record's id in that module (supplier id, staff id, licence id)
  entity_id    text        not null,
  -- what the person called it, for the list
  file_name    text        not null,
  -- path inside the storage bucket
  storage_path text        not null unique,
  mime_type    text        not null,
  size_bytes   bigint      not null,
  -- optional: certificates expire, and the reminder should come from the
  -- document itself rather than a separately-typed date that drifts from it
  expires_on   date,
  uploaded_by  text,
  uploaded_at  timestamptz not null default now(),
  notes        text
);

-- The list view is always "everything attached to this record".
create index if not exists documents_entity_idx
  on documents (tenant_id, entity_type, entity_id, uploaded_at desc);

-- Expiry sweeps ask "what lapses in the next N days" across every type.
create index if not exists documents_expiry_idx
  on documents (tenant_id, expires_on)
  where expires_on is not null;

alter table documents enable row level security;

-- Signed-in staff may read the index. Deliberately readable by everyone who
-- works here: a chef receiving a delivery may need to check the supplier's
-- certificate is current, and hiding it helps nobody.
drop policy if exists "Staff can read documents" on documents;
create policy "Staff can read documents" on documents
  for select using (auth.role() = 'authenticated');

drop policy if exists "Staff can add documents" on documents;
create policy "Staff can add documents" on documents
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Staff can update documents" on documents;
create policy "Staff can update documents" on documents
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Deleting is allowed: unlike a food-safety log, a document is a copy of
-- something that exists elsewhere, and a wrong file uploaded to the wrong
-- supplier should be removable rather than permanent.
drop policy if exists "Staff can remove documents" on documents;
create policy "Staff can remove documents" on documents
  for delete using (auth.role() = 'authenticated');

-- ---------- Storage ----------
-- Private. These carry business registration numbers, staff health data and
-- supplier pricing context; reads go through short-lived signed URLs.
-- 10 MB ceiling: a scan or a phone photo of a certificate, not a video.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff can read document files" on storage.objects;
create policy "Staff can read document files" on storage.objects
  for select using (bucket_id = 'documents' and auth.role() = 'authenticated');

drop policy if exists "Staff can upload document files" on storage.objects;
create policy "Staff can upload document files" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');

drop policy if exists "Staff can remove document files" on storage.objects;
create policy "Staff can remove document files" on storage.objects
  for delete using (bucket_id = 'documents' and auth.role() = 'authenticated');
