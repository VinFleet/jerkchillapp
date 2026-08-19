-- Jerk & Chill — Table Booking schema
--
-- HOW TO RUN THIS:
-- 1. Open your Supabase project at supabase.com/dashboard
-- 2. Go to SQL Editor -> New query
-- 3. Paste this whole file and click Run
--
-- This is safe to re-run — every statement is idempotent.

create extension if not exists "pgcrypto";

-- ---------- Restaurant tables (floor plan) ----------

create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'jerk-and-chill-thao-dien',
  table_number text not null,
  seats int not null check (seats > 0),
  pos_x real not null default 0,
  pos_y real not null default 0,
  shape text not null default 'square' check (shape in ('square', 'round', 'rect')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Bookings ----------

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'jerk-and-chill-thao-dien',
  table_id uuid references restaurant_tables(id) on delete set null,
  booking_date date not null,
  booking_time time not null,
  party_size int not null check (party_size > 0),
  duration_minutes int not null default 90,
  customer_name text not null,
  customer_phone text not null,
  special_requests text,
  allergies text,
  status text not null default 'confirmed' check (status in ('confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  source text not null default 'staff' check (source in ('staff', 'online')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_date_idx on bookings (tenant_id, booking_date);
create index if not exists bookings_table_idx on bookings (table_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bookings_set_updated_at on bookings;
create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ---------- Row Level Security ----------
-- The anon key is public (it ships in the website's page source), so every
-- policy here is written assuming a stranger on the internet has it.

alter table restaurant_tables enable row level security;
alter table bookings enable row level security;

drop policy if exists "Public can view tables" on restaurant_tables;
create policy "Public can view tables" on restaurant_tables
  for select using (true);

drop policy if exists "Staff can manage tables" on restaurant_tables;
create policy "Staff can manage tables" on restaurant_tables
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Public can create a booking (this is the online booking form) but there is
-- deliberately NO public select policy on bookings — a stranger with the
-- anon key cannot read anyone's name, phone number, or allergy info back out.
drop policy if exists "Public can create bookings" on bookings;
create policy "Public can create bookings" on bookings
  for insert with check (source = 'online');

drop policy if exists "Staff can view all bookings" on bookings;
create policy "Staff can view all bookings" on bookings
  for select using (auth.role() = 'authenticated');

drop policy if exists "Staff can create bookings" on bookings;
create policy "Staff can create bookings" on bookings
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Staff can update bookings" on bookings;
create policy "Staff can update bookings" on bookings
  for update using (auth.role() = 'authenticated');

drop policy if exists "Staff can delete bookings" on bookings;
create policy "Staff can delete bookings" on bookings
  for delete using (auth.role() = 'authenticated');

-- ============================================================================
-- KNOWN LIMITATION — floor-plan and booking editing is NOT enforced in the database
-- ============================================================================
--
-- What the app does today:
--   The "Arrange tables" controls on the Bookings screen are gated by
--   canEditFloorPlan() in src/lib/auth/permissions.ts, which allows Owner and
--   Manager only. That is a UI guard and nothing more.
--
-- What the database actually allows today:
--   The "Staff can manage tables" policy above grants INSERT/UPDATE/DELETE on
--   restaurant_tables to ANY authenticated session, and the "Staff can ..."
--   booking policies do the same for bookings. The restaurant signs in through
--   ONE shared staff login: the role (owner/manager/chef/bartender) is picked
--   on the device and stored in the browser's own localStorage under
--   `jc_session` (see src/lib/auth/RoleContext.tsx). Postgres never sees it.
--   So the database genuinely cannot tell a bartender from a manager — every
--   one of them arrives as the same Supabase user with
--   auth.role() = 'authenticated'.
--
-- The concrete gap:
--   Anyone who can sign in to the staff app — or who has the shared password,
--   or who simply edits `jc_session` in their own browser devtools — can
--   create, rename, move or deactivate tables, and read/edit every booking.
--   The public anon key is NOT affected: it can still only read
--   restaurant_tables and insert bookings with source = 'online'.
--
-- Why it isn't fixed here:
--   Closing it properly requires one Supabase auth user per person. That is an
--   operational change (every staff member gets their own login and password),
--   not a schema tweak, so it can't be done from this file alone. Until then,
--   treat "Owner/Manager only" on the floor plan as a convention that keeps
--   honest people from tapping the wrong thing — not as a security boundary.
--
-- The migration path is scaffolded below and is deliberately inert today.
-- ============================================================================

-- ---------- staff_roles — scaffold for per-person logins ----------
-- Created for real, but empty and unread: no policy below consults it yet.
-- Creating it now means the switch to per-person logins is a data + policy
-- change, not a schema migration.

create table if not exists staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null default 'jerk-and-chill-thao-dien',
  role text not null check (role in ('owner', 'manager', 'chef', 'bartender')),
  full_name text,
  created_at timestamptz not null default now()
);

alter table staff_roles enable row level security;

-- A signed-in person may read their own row and nobody else's. There is
-- deliberately no insert/update/delete policy: roles are assigned by hand in
-- the Supabase dashboard, so a compromised app session cannot promote itself.
drop policy if exists "Staff can read own role" on staff_roles;
create policy "Staff can read own role" on staff_roles
  for select using (auth.uid() = user_id);

-- Reads the caller's role past staff_roles' own RLS. Returns null for the
-- shared login (it has no staff_roles row), which is exactly why the policies
-- below must stay commented out until every person has their own account.
create or replace function current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from staff_roles where user_id = auth.uid();
$$;

-- ---------- HOW TO ACTUALLY ENFORCE ROLES (do not run yet) ----------
--
-- Prerequisites, in this order — skipping any of them locks staff out:
--   1. Create a Supabase auth user for every member of staff
--      (Dashboard -> Authentication -> Users -> Add user).
--   2. Insert a staff_roles row for each one, e.g.
--        insert into staff_roles (user_id, role, full_name)
--        values ('<uuid-from-step-1>', 'manager', 'Tên Nhân Viên');
--      Verify with: select * from staff_roles;  -- every active person listed
--   3. Change the app to sign each person in with their own email/password
--      instead of the shared staff login, and to take the role from
--      current_staff_role() rather than from localStorage `jc_session`.
--   4. Only once 1–3 are live and verified, uncomment the block below and run
--      it. It replaces the permissive policies with role-aware ones.
--   5. Re-test on a real device per role BEFORE the next service, and keep the
--      rollback below to hand.
--
-- ---- BEGIN role-aware policies (commented out) ----
--
-- -- Floor plan: only Owner/Manager may change it; everyone signed in can read it.
-- drop policy if exists "Staff can manage tables" on restaurant_tables;
-- create policy "Managers can manage tables" on restaurant_tables
--   for all
--   using (current_staff_role() in ('owner', 'manager'))
--   with check (current_staff_role() in ('owner', 'manager'));
--
-- -- Bookings: any signed-in staff member may read and take bookings...
-- drop policy if exists "Staff can view all bookings" on bookings;
-- create policy "Staff can view all bookings" on bookings
--   for select using (current_staff_role() is not null);
--
-- drop policy if exists "Staff can create bookings" on bookings;
-- create policy "Staff can create bookings" on bookings
--   for insert with check (current_staff_role() is not null);
--
-- drop policy if exists "Staff can update bookings" on bookings;
-- create policy "Staff can update bookings" on bookings
--   for update using (current_staff_role() is not null);
--
-- -- ...but deleting a booking stays with Owner/Manager (the app only ever
-- -- cancels, so this should almost never fire).
-- drop policy if exists "Staff can delete bookings" on bookings;
-- create policy "Managers can delete bookings" on bookings
--   for delete using (current_staff_role() in ('owner', 'manager'));
--
-- ---- END role-aware policies ----
--
-- ROLLBACK (restores today's behaviour if the above locks anyone out):
--   drop policy if exists "Managers can manage tables" on restaurant_tables;
--   create policy "Staff can manage tables" on restaurant_tables
--     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   drop policy if exists "Managers can delete bookings" on bookings;
--   create policy "Staff can delete bookings" on bookings
--     for delete using (auth.role() = 'authenticated');
--   -- then re-run the three "Staff can ..." booking policies from the section above.

-- ---------- Public availability view ----------
-- The website needs to know which slots are free, but must never see WHO
-- booked them. This view exposes only the columns needed to render
-- availability — no name, phone, requests, or allergies.
--
-- security_invoker = false is deliberate: this view is allowed to read
-- across the RLS wall on `bookings` (that's the whole point), while only
-- ever exposing the limited column list below.
drop view if exists booking_availability;
create view booking_availability
  with (security_invoker = false)
  as
  select id, tenant_id, table_id, booking_date, booking_time, party_size, duration_minutes, status
  from bookings
  where status in ('confirmed', 'seated');

grant select on booking_availability to anon, authenticated;

-- ---------- Realtime ----------
-- Lets the staff tablet subscribe and see a new online booking the instant
-- it's created, with no page refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table bookings;
  end if;
end $$;
