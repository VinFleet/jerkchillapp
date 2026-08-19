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
