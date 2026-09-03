-- Three RLS gaps a full-app audit found, all closed here.
--
-- Run once, after saas-schema.sql (needs auth_tenants()).

-- ---------- 1. payment_webhook_events was never re-fenced ----------
--
-- saas-schema.sql re-scoped synced_records, print_jobs, and documents to
-- auth_tenants() when the org/branch model landed, but this table
-- (orders-schema.sql, predates that migration) was missed: any authenticated
-- staff member of ANY restaurant could read every OTHER restaurant's bank
-- transfer and card-terminal payloads — amounts, memos, provider refs.

drop policy if exists "Staff can read payment events" on payment_webhook_events;
create policy "Staff can read payment events" on payment_webhook_events
  for select to authenticated
  using (tenant_id in (select auth_tenants()));

-- ---------- 2 & 3. the "public booking form" policies, for a form that was
-- never built ----------
--
-- schema.sql's original public policies (`using (true)` on restaurant_tables,
-- an unscoped INSERT on bookings) predate the org/branch model and were left
-- alone on purpose at the time — saas-schema.sql's own comment says so,
-- reasoning "a booking form must work for strangers." No such form exists
-- anywhere in the app (grepped the whole repo to confirm: nothing outside
-- src/lib/bookings/repo.ts references these tables, and that file is
-- staff-only, already correctly scoped by saas-schema.sql's
-- "members manage their..." policies). So this was pure unused attack
-- surface: the anon key ships in every page's client bundle, and with it
-- anyone could read every branch's floor plan and booking calendar, or
-- insert a booking into any branch by naming its tenant_id.
--
-- If a real public booking widget gets built later, it needs its own
-- tenant-scoped design — a signed link like /order/[token], not a raw anon
-- Supabase read — not what's restored here.

drop policy if exists "Public can view tables" on restaurant_tables;
drop policy if exists "Public can create bookings" on bookings;

-- booking_availability IS used today, by staff (bookings/repo.ts) — so it
-- is re-scoped, not dropped. It runs `security_invoker = false` on purpose
-- (to expose only date/time/party-size/table columns across the RLS wall on
-- `bookings`, hiding guest name/phone/allergy info even from other staff at
-- the same table) — but that bypass had no tenant filter of its own, so it
-- silently returned every OTHER branch's booking calendar too, relying only
-- on the app's own client-side `.eq("tenant_id", ...)` as the boundary. The
-- filter now lives in the view itself.
drop view if exists booking_availability;
create view booking_availability
  with (security_invoker = false)
  as
  select id, tenant_id, table_id, booking_date, booking_time, party_size, duration_minutes, status
  from bookings
  where status in ('confirmed', 'seated')
    and tenant_id in (select auth_tenants());

-- anon dropped: nothing public reads this. auth_tenants() returns nothing for
-- an anon caller anyway (no auth.uid()), so this line is defense in depth,
-- not the only thing standing between a stranger and the calendar.
revoke select on booking_availability from anon;
grant select on booking_availability to authenticated;
