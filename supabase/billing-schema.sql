-- Billing, the way VINPOS actually charges: signup is free, money is for
-- setup and support, and it arrives as a bank transfer the customer scans
-- from a VietQR — no card processor anywhere.
--
-- Two tables: the ledger (every payment recorded, append-style) and the
-- status it rolls up to (setup paid, supported until when). The platform
-- writes both through the admin API; an organization's members may read
-- their own status, because "am I supported" is their question too.
--
-- Run once, after saas-schema.sql.

create table if not exists org_billing (
  org_id        text        primary key references organizations (id),
  setup_paid_at timestamptz,
  support_until date,
  notes         text,
  updated_at    timestamptz not null default now()
);

create table if not exists platform_billing_payments (
  id           uuid        primary key default gen_random_uuid(),
  org_id       text        not null references organizations (id),
  kind         text        not null check (kind in ('setup', 'support')),
  amount_vnd   bigint      not null check (amount_vnd > 0),
  -- How many months of support this payment buys. Zero for a setup fee.
  months       int         not null default 0 check (months >= 0),
  -- The bank memo reference, for matching against the statement.
  reference    text,
  recorded_by  uuid        not null,
  received_at  timestamptz not null default now()
);

alter table org_billing enable row level security;
alter table platform_billing_payments enable row level security;

-- An org can see its own standing; only the platform writes.
drop policy if exists "members see their billing status" on org_billing;
create policy "members see their billing status" on org_billing
  for select to authenticated
  using (org_id in (select my_org_ids()));

-- The ledger is the platform's book: service-role only, no policies.

-- ---------- support packages ----------
--
-- Three tiers, priced per restaurant per month: the charge for an
-- organization is tier price x branch count x months. Prices live here and
-- are edited in the admin console, not in code — a price change is a
-- business decision, not a deploy. The amounts below are the real launch
-- prices (set 2 Sep 2026); on-conflict-do-nothing means an existing
-- database keeps whatever the console has set since.

create table if not exists support_packages (
  id                   text   primary key,
  name                 text   not null,
  price_per_branch_vnd bigint not null check (price_per_branch_vnd >= 0),
  sort                 int    not null default 0
);

insert into support_packages (id, name, price_per_branch_vnd, sort) values
  ('basic',    'Basic',    350000, 1),
  ('standard', 'Standard', 550000, 2),
  ('premium',  'Premium',  750000, 3)
on conflict (id) do nothing;

alter table support_packages enable row level security;

-- A price list is for reading: customers see what the tiers cost.
drop policy if exists "anyone signed in can read the price list" on support_packages;
create policy "anyone signed in can read the price list" on support_packages
  for select to authenticated using (true);

-- Which tier an org is on, and what each payment was for.
alter table org_billing add column if not exists package_id text references support_packages (id);
alter table platform_billing_payments add column if not exists package_id text;
alter table platform_billing_payments add column if not exists branches_count int;
