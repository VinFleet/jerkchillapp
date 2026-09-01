-- The e-invoice queue — same architecture as printing, for the same reason.
--
-- Issuing an invoice needs credentials the till must never hold, so the till
-- enqueues a snapshot here and a server-side worker (future: the daily sweep
-- or an admin action) drives the provider API with service-role access.
-- A queued job that cannot issue stays visible with its error, because a
-- silently missing tax invoice is a fine.
--
-- Run once, after saas-schema.sql (needs auth_tenants()).

create table if not exists einvoice_jobs (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null,
  order_id     text        not null,
  -- the full EInvoiceRequest, frozen at close — the invoice must describe
  -- the bill as it was, even if the menu changes tomorrow
  request      jsonb       not null,
  provider     text        not null default 'misa'
               check (provider in ('misa', 'viettel', 'vnpt')),
  status       text        not null default 'queued'
               check (status in ('queued', 'issued', 'failed')),
  provider_invoice_id text,
  lookup_code  text,
  error        text,
  created_at   timestamptz not null default now(),
  issued_at    timestamptz
);

-- One invoice per order per branch; a retry updates, never duplicates.
create unique index if not exists einvoice_jobs_order_idx
  on einvoice_jobs (tenant_id, order_id);

create index if not exists einvoice_jobs_queue_idx
  on einvoice_jobs (tenant_id, status, created_at);

alter table einvoice_jobs enable row level security;

-- Members of the branch enqueue and watch their own queue; only the worker
-- (service role) issues and writes results.
drop policy if exists "members enqueue einvoices" on einvoice_jobs;
create policy "members enqueue einvoices" on einvoice_jobs
  for insert to authenticated
  with check (tenant_id in (select auth_tenants()));

drop policy if exists "members see their einvoices" on einvoice_jobs;
create policy "members see their einvoices" on einvoice_jobs
  for select to authenticated
  using (tenant_id in (select auth_tenants()));

-- Provider credentials, when integration lands, go in a service-role-only
-- table on the branch_secrets pattern — NEVER in synced_records, which every
-- member of the branch can read:
--
-- create table einvoice_credentials (
--   tenant_id text primary key,
--   provider  text not null,
--   config    jsonb not null,   -- appId, license, endpoint, template/serial
--   updated_at timestamptz not null default now()
-- );
-- alter table einvoice_credentials enable row level security;  -- no policies
