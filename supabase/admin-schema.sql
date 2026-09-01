-- The platform's own staff — the people who run VINPOS, not a restaurant.
--
-- A platform admin creates organizations, branches and user accounts, and
-- can suspend an organization. They are deliberately NOT members of every
-- org: their power flows through the service role on the admin API routes,
-- which check this table before acting. RLS on customer data never has to
-- know admins exist.
--
-- Run once, after saas-schema.sql.

create table if not exists platform_admins (
  user_id    uuid        primary key,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

-- The only thing a signed-in user may ask is "am I one?".
drop policy if exists "you can see whether you are an admin" on platform_admins;
create policy "you can see whether you are an admin" on platform_admins
  for select to authenticated using (user_id = auth.uid());

-- The existing owner login becomes the first platform admin.
insert into platform_admins (user_id)
select user_id from staff_roles where role = 'owner'
on conflict (user_id) do nothing;

-- ---------- suspension ----------

alter table organizations add column if not exists active boolean not null default true;

-- A suspended organization's branches stop resolving for its members, which
-- switches off sync, printing and the till in one place. Data is kept.
create or replace function auth_tenants()
returns setof text
language sql
security definer
set search_path = public
stable
as $$
  select b.id
  from branches b
  join organizations o on o.id = b.org_id and o.active
  join org_members m on m.org_id = b.org_id
  where m.user_id = auth.uid();
$$;
