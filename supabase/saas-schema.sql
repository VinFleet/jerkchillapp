-- VINPOS: organizations, branches, and the wall between restaurants.
--
-- Until now every policy said "any authenticated user" — right for one
-- restaurant, fatal for a product sold to many, because any restaurant's
-- staff login could read every other restaurant's orders. This migration
-- adds the org -> branch model and rewrites row security so a person can
-- touch exactly the branches of the organizations they belong to.
--
-- Existing data is adopted, not migrated: Jerk & Chill becomes the first
-- organization, its tenant id becomes the first branch, and every existing
-- staff login becomes a member. Nothing moves; the fence goes up around it.
--
-- Run once, in the Supabase SQL editor.

-- ---------- the model ----------

create table if not exists organizations (
  id         text        primary key,          -- slug, e.g. 'jerk-and-chill'
  name       text        not null,
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id         text        primary key,          -- the tenant_id, e.g. 'jerk-and-chill-thao-dien'
  org_id     text        not null references organizations (id),
  name       text        not null,             -- 'Thảo Điền'
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id     text        not null references organizations (id),
  user_id    uuid        not null,
  role       text        not null default 'staff'
             check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ---------- adopt the existing restaurant ----------

insert into organizations (id, name)
values ('jerk-and-chill', 'Jerk & Chill')
on conflict (id) do nothing;

insert into branches (id, org_id, name)
values ('jerk-and-chill-thao-dien', 'jerk-and-chill', 'Thảo Điền')
on conflict (id) do nothing;

-- Every login that already has a staff role belongs to the first org.
insert into org_members (org_id, user_id, role)
select 'jerk-and-chill', user_id,
       case when role in ('owner', 'manager') then role else 'staff' end
from staff_roles
on conflict (org_id, user_id) do nothing;

-- ---------- who may touch which branch ----------

-- The one question every policy asks. SECURITY DEFINER so it can read the
-- membership tables regardless of the caller's own policies; STABLE so the
-- planner runs it once per statement, not once per row.
create or replace function auth_tenants()
returns setof text
language sql
security definer
set search_path = public
stable
as $$
  select b.id
  from branches b
  join org_members m on m.org_id = b.org_id
  where m.user_id = auth.uid();
$$;

-- ---------- the fence, table by table ----------

-- synced_records: the shared copy of everything operational.
drop policy if exists "Staff can read synced records" on synced_records;
drop policy if exists "Staff can insert synced records" on synced_records;
drop policy if exists "Staff can update synced records" on synced_records;
drop policy if exists "Staff can delete synced records" on synced_records;

create policy "members read their branches" on synced_records
  for select using (tenant_id in (select auth_tenants()));
create policy "members write their branches" on synced_records
  for insert with check (tenant_id in (select auth_tenants()));
create policy "members update their branches" on synced_records
  for update using (tenant_id in (select auth_tenants()))
  with check (tenant_id in (select auth_tenants()));
create policy "members delete their branches" on synced_records
  for delete using (tenant_id in (select auth_tenants()));

-- print_jobs: enqueue and watch only your own branches. The bridge uses the
-- service role and is unaffected.
drop policy if exists "staff can enqueue print jobs" on print_jobs;
drop policy if exists "staff can read print jobs" on print_jobs;

create policy "members enqueue for their branches" on print_jobs
  for insert to authenticated with check (tenant_id in (select auth_tenants()));
create policy "members watch their branches" on print_jobs
  for select to authenticated using (tenant_id in (select auth_tenants()));

-- documents
drop policy if exists "Staff can read documents" on documents;
drop policy if exists "Staff can add documents" on documents;
drop policy if exists "Staff can update documents" on documents;
drop policy if exists "Staff can remove documents" on documents;

create policy "members read their documents" on documents
  for select to authenticated using (tenant_id in (select auth_tenants()));
create policy "members add their documents" on documents
  for insert to authenticated with check (tenant_id in (select auth_tenants()));
create policy "members update their documents" on documents
  for update to authenticated using (tenant_id in (select auth_tenants()))
  with check (tenant_id in (select auth_tenants()));
create policy "members remove their documents" on documents
  for delete to authenticated using (tenant_id in (select auth_tenants()));

-- push subscriptions
drop policy if exists "Staff can register a device" on push_subscriptions;
drop policy if exists "Staff can update a device" on push_subscriptions;
drop policy if exists "Staff can remove a device" on push_subscriptions;
drop policy if exists "Staff can read a device" on push_subscriptions;

-- Registration goes through the server route (service role), so no insert
-- policy is needed for devices; reads stay members-only.
create policy "members see their branch devices" on push_subscriptions
  for select to authenticated using (tenant_id in (select auth_tenants()));

-- bookings & tables: staff-side scoped to membership. The PUBLIC policies
-- (a guest reading the floor plan, creating a booking) are left as they are
-- deliberately: a booking form must work for strangers, and rows carry the
-- branch they belong to.
drop policy if exists "Staff can manage tables" on restaurant_tables;
drop policy if exists "Managers can manage tables" on restaurant_tables;
create policy "members manage their tables" on restaurant_tables
  for all to authenticated
  using (tenant_id in (select auth_tenants()))
  with check (tenant_id in (select auth_tenants()));

drop policy if exists "Staff can view all bookings" on bookings;
drop policy if exists "Staff can create bookings" on bookings;
drop policy if exists "Staff can update bookings" on bookings;
drop policy if exists "Staff can delete bookings" on bookings;
drop policy if exists "Managers can delete bookings" on bookings;
create policy "members manage their bookings" on bookings
  for all to authenticated
  using (tenant_id in (select auth_tenants()))
  with check (tenant_id in (select auth_tenants()));

-- The model tables themselves.
--
-- These policies must NOT query org_members inline: a policy on org_members
-- that selects from org_members is infinite recursion, and Postgres refuses
-- it at query time. The SECURITY DEFINER helpers below read the membership
-- tables with the function owner's rights, which sidesteps the recursion for
-- every policy that needs the same answer.
create or replace function my_org_ids()
returns setof text
language sql
security definer
set search_path = public
stable
as $$
  select org_id from org_members where user_id = auth.uid();
$$;

create or replace function my_owned_org_ids()
returns setof text
language sql
security definer
set search_path = public
stable
as $$
  select org_id from org_members where user_id = auth.uid() and role = 'owner';
$$;

alter table organizations enable row level security;
alter table branches enable row level security;
alter table org_members enable row level security;

create policy "members see their org" on organizations
  for select to authenticated
  using (id in (select my_org_ids()));

create policy "members see their branches" on branches
  for select to authenticated
  using (org_id in (select my_org_ids()));

create policy "owners add branches" on branches
  for insert to authenticated
  with check (org_id in (select my_owned_org_ids()));

create policy "members see membership" on org_members
  for select to authenticated
  using (org_id in (select my_org_ids()));

-- ---------- signing up a brand-new restaurant ----------

-- One transaction: the org, its first branch, and the caller as owner.
-- SECURITY DEFINER because the caller is not yet a member of anything.
create or replace function create_organization(
  org_name text,
  org_slug text,
  branch_name text,
  branch_slug text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if org_slug !~ '^[a-z0-9-]{3,40}$' or branch_slug !~ '^[a-z0-9-]{3,60}$' then
    raise exception 'slugs are lowercase letters, digits and dashes';
  end if;

  insert into organizations (id, name) values (org_slug, org_name);
  insert into branches (id, org_id, name) values (branch_slug, org_slug, branch_name);
  insert into org_members (org_id, user_id, role) values (org_slug, auth.uid(), 'owner');
end;
$$;
