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
