-- Jerk & Chill — Web Push subscriptions
--
-- HOW TO RUN THIS:
-- 1. Open your Supabase project at supabase.com/dashboard
-- 2. Go to SQL Editor -> New query
-- 3. Paste this whole file and click Run
--
-- Safe to re-run — every statement is idempotent.
--
-- WHAT THIS IS FOR
-- Alerts that reach a phone even when the app is closed: an order ready to
-- send, a fridge out of range, a table changed. Unlike Zalo, this works after
-- 22:00 — which is when the closing checklist and the last fridge check
-- actually happen — and costs nothing per message.
--
-- One row per device per person. The same phone used by two people on
-- different shifts holds two rows; the same person on a phone and a tablet
-- holds two as well. That is intentional: a subscription belongs to a browser
-- installation, and the person is attached so we know whose preferences apply.

create table if not exists push_subscriptions (
  -- The endpoint URL the browser's push service issued. Unique per
  -- installation, and the natural primary key — re-subscribing with the same
  -- browser returns the same endpoint, so upserting on it avoids duplicates.
  endpoint    text        primary key,
  tenant_id   text        not null default 'jerk-and-chill-thao-dien',
  -- Whose phone this is, from the staff list. Null is allowed: a device can
  -- subscribe before anyone has picked a name, and gets the defaults.
  staff_id    text,
  staff_name  text,
  -- The two keys from PushSubscription.toJSON().keys — needed to encrypt the
  -- payload for this specific browser.
  p256dh      text        not null,
  auth        text        not null,
  -- Which alerts this person wants. Chosen by them, not derived from a role.
  categories  text[]      not null default array['notices','food_safety'],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_tenant
  on push_subscriptions (tenant_id);

-- Send fan-out asks "who wants this category", so index the array itself.
create index if not exists push_subscriptions_categories
  on push_subscriptions using gin (categories);

alter table push_subscriptions enable row level security;

-- Signed-in staff may register their own device and change their own choices.
-- Reading every subscription is deliberately NOT granted: the row set is a
-- list of who works here and what they want to hear about, and nothing in the
-- app needs to read it. The server sends, using the service role.
drop policy if exists "Staff can register a device" on push_subscriptions;
create policy "Staff can register a device" on push_subscriptions
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Staff can update a device" on push_subscriptions;
create policy "Staff can update a device" on push_subscriptions
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Turning notifications off must actually remove the row, or the server keeps
-- pushing to a device whose owner opted out.
drop policy if exists "Staff can remove a device" on push_subscriptions;
create policy "Staff can remove a device" on push_subscriptions
  for delete using (auth.role() = 'authenticated');

-- A device needs to read back its own row to show the person their current
-- choices. Scoped to a single endpoint by the app's query; there is no way to
-- list all rows through this policy because the endpoint is unguessable.
drop policy if exists "Staff can read a device" on push_subscriptions;
create policy "Staff can read a device" on push_subscriptions
  for select using (auth.role() = 'authenticated');
