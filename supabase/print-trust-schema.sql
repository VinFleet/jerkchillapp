-- Printing trust: a third station, and a heartbeat.
--
-- 'bar' joins the printer stations so drinks route to the bar's printer when
-- one exists. The heartbeat is how a waiter is warned BEFORE tapping Send
-- that tickets will not print — a failed print discovered after the fact is
-- how staff stop trusting the till.
--
-- Run once, after print-jobs-schema.sql.

alter table print_jobs drop constraint if exists print_jobs_printer_check;
alter table print_jobs add constraint print_jobs_printer_check
  check (printer in ('kitchen', 'receipt', 'bar'));

create table if not exists print_bridge_status (
  tenant_id text        primary key,
  seen_at   timestamptz not null,
  printers  jsonb       not null default '{}'::jsonb
);

alter table print_bridge_status enable row level security;

-- Members read their own bridge's pulse; only the bridge (service) writes.
drop policy if exists "members see their bridge" on print_bridge_status;
create policy "members see their bridge" on print_bridge_status
  for select to authenticated
  using (tenant_id in (select auth_tenants()));
