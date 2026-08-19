-- Jerk & Chill — Multi-device sync
--
-- HOW TO RUN THIS:
-- 1. Open your Supabase project at supabase.com/dashboard
-- 2. Go to SQL Editor -> New query
-- 3. Paste this whole file and click Run
--
-- Safe to re-run — every statement is idempotent.
--
-- WHY ONE TABLE INSTEAD OF ONE PER MODULE
-- The app is local-first: every device keeps working offline on unreliable
-- kitchen wifi, and reads always come from local storage. Supabase is only
-- the shared copy that devices push to and pull from. Because nothing is
-- ever queried relationally on the server, a single generic table gives us
-- one set of RLS policies and one realtime channel instead of four of each —
-- and adding a new synced module later needs no migration at all.

create extension if not exists "pgcrypto";

create table if not exists synced_records (
  tenant_id   text        not null default 'jerk-and-chill-thao-dien',
  -- which module's collection this row belongs to, e.g. 'checklist_ticks'
  collection  text        not null,
  -- the record's own id from the app (checklist item id, notice id, ...)
  record_id   text        not null,
  -- the whole record, exactly as the app stores it locally
  data        jsonb       not null,
  -- tombstone: kept rather than hard-deleted so other devices learn about it
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, collection, record_id)
);

-- Pull is always "everything in these collections changed since X", so this
-- is the only index shape that matters.
create index if not exists synced_records_pull_idx
  on synced_records (tenant_id, collection, updated_at);

-- Server-side timestamp on every write. Devices must never set updated_at
-- themselves — a tablet with a wrong clock would otherwise win or lose every
-- conflict permanently.
create or replace function sync_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists synced_records_set_updated_at on synced_records;
create trigger synced_records_set_updated_at
  before insert or update on synced_records
  for each row execute function sync_set_updated_at();

-- ---------- Row Level Security ----------

alter table synced_records enable row level security;

-- Operational data (who ticked which checklist, today's stock counts, notice
-- board posts) is staff-only — there is no public read here, unlike the
-- booking availability check.
drop policy if exists "Staff can read synced records" on synced_records;
create policy "Staff can read synced records" on synced_records
  for select using (auth.role() = 'authenticated');

-- Operational data (checklists, notices, stock) is freely writable.
drop policy if exists "Staff can write synced records" on synced_records;
drop policy if exists "Staff can insert synced records" on synced_records;
create policy "Staff can insert synced records" on synced_records
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Staff can update synced records" on synced_records;
create policy "Staff can update synced records" on synced_records
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- Food-safety logs are append-only, enforced here ----------
-- These are legal records (QĐ 1246/QĐ-BYT, Circular 30/2012/TT-BYT) and must
-- be tamper-evident: a correction writes a new row that supersedes the old
-- one, so nothing is ever edited away or removed. The app already refuses to
-- delete them, but an app-side rule is a convention — this makes it a
-- guarantee, including against anyone with the shared staff password and a
-- REST client.
drop policy if exists "Staff can delete synced records" on synced_records;
create policy "Staff can delete synced records" on synced_records
  for delete using (auth.role() = 'authenticated' and collection not like 'fs\_%');

-- Blocks the other route to the same outcome: flipping `deleted` on an
-- existing food-safety row, or rewriting one that's already been filed.
create or replace function guard_food_safety_append_only()
returns trigger as $$
begin
  if old.collection like 'fs\_%' then
    if new.deleted then
      raise exception 'Food-safety records cannot be deleted (collection %, record %)', old.collection, old.record_id;
    end if;
    -- The record's own identity is fixed; only forward progress is allowed
    -- (a cleaning sign-off being withdrawn, a sample discarded, a complaint
    -- outcome revised — all of which keep the prior state inside `data`).
    if new.record_id <> old.record_id or new.collection <> old.collection then
      raise exception 'Food-safety records cannot be re-keyed';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists synced_records_food_safety_guard on synced_records;
create trigger synced_records_food_safety_guard
  before update on synced_records
  for each row execute function guard_food_safety_append_only();

-- NOTE — same limitation as restaurant_tables: the app signs in with one
-- shared staff account, so Supabase cannot tell a bartender's session from a
-- manager's. Role restrictions (e.g. only Owner/Manager may edit checklist
-- templates) are enforced in the app, not here. Closing that gap needs
-- per-person logins; see the staff_roles scaffold in schema.sql.

-- ---------- Realtime ----------
-- Lets a manager's phone see a checklist tick the moment the kitchen tablet
-- makes it, rather than on the next poll.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'synced_records'
  ) then
    alter publication supabase_realtime add table synced_records;
  end if;
end $$;
