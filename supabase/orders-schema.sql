-- Jerk & Chill — payment confirmation webhooks
--
-- HOW TO RUN THIS:
-- 1. Open your Supabase project at supabase.com/dashboard
-- 2. Go to SQL Editor -> New query
-- 3. Paste this whole file and click Run
--
-- Safe to re-run — every statement is idempotent.
--
-- Orders and payments themselves sync through `synced_records` like every
-- other operational collection, so they need no tables here. What does need a
-- table is the webhook log: money arriving is the one event where "we think we
-- processed that" is not good enough.

create table if not exists payment_webhook_events (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null default 'jerk-and-chill-thao-dien',
  -- 'sepay' | 'casso' | '9pay'
  provider      text        not null,
  -- The provider's own id for this event. The unique constraint below is what
  -- makes replays harmless: every one of these services retries on a non-200,
  -- and a retried transfer must not settle a bill twice.
  provider_ref  text        not null,
  -- Our reference, carried in the bank memo. Null when a transfer arrives that
  -- no order claims — which happens, and must be visible rather than dropped.
  reference     text,
  amount_vnd    bigint      not null,
  -- Whole payload, verbatim. When a payment is disputed weeks later this is
  -- the only record of what the provider actually said.
  payload       jsonb       not null,
  matched       boolean     not null default false,
  received_at   timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index if not exists payment_webhook_reference_idx
  on payment_webhook_events (tenant_id, reference)
  where reference is not null;

-- Unmatched money is the thing a manager needs to see: someone transferred
-- with a mistyped reference and is standing at the till.
create index if not exists payment_webhook_unmatched_idx
  on payment_webhook_events (tenant_id, received_at desc)
  where matched = false;

alter table payment_webhook_events enable row level security;

-- Written only by the server, using the service role, because the webhook
-- arrives from a provider rather than from a signed-in device. Staff may read,
-- so an unmatched transfer can be reconciled at the till.
drop policy if exists "Staff can read payment events" on payment_webhook_events;
create policy "Staff can read payment events" on payment_webhook_events
  for select using (auth.role() = 'authenticated');

-- Deliberately no insert, update or delete policy. A payment record that staff
-- could edit is not evidence of anything.
