-- Secrets a branch's server-side needs — starting with the payment webhook
-- signing secret.
--
-- Deliberately NOT in synced_records: those rows are readable by every
-- member of the branch, and whoever holds this secret can forge "paid"
-- confirmations. RLS is enabled with NO policies, which in Postgres means
-- nobody but the service role touches it — owners set it through an
-- authenticated API route, and the webhook route reads it to verify.
--
-- Run once, after saas-schema.sql.

create table if not exists branch_secrets (
  tenant_id      text        primary key references branches (id),
  webhook_secret text        not null,
  updated_at     timestamptz not null default now()
);

alter table branch_secrets enable row level security;
-- No policies, on purpose: service-role only.
