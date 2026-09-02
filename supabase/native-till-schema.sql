-- The native till app as print brain — the policies that let it claim.
--
-- Until now only the bridge (service role) could claim and complete print
-- jobs, and only the bridge could heartbeat. The native till app does both
-- from an ordinary member session, so members get UPDATE on their own
-- branch's queue and pulse. Claiming stays safe under concurrency because
-- every claimer — bridge or till — uses the same compare-and-swap (UPDATE
-- ... WHERE status = 'queued'), which only one can win.
--
-- Run once, after print-trust-schema.sql.

drop policy if exists "members claim their print jobs" on print_jobs;
create policy "members claim their print jobs" on print_jobs
  for update to authenticated
  using (tenant_id in (select auth_tenants()))
  with check (tenant_id in (select auth_tenants()));

drop policy if exists "members heartbeat their bridge" on print_bridge_status;
create policy "members heartbeat their bridge" on print_bridge_status
  for insert to authenticated
  with check (tenant_id in (select auth_tenants()));

drop policy if exists "members update their bridge pulse" on print_bridge_status;
create policy "members update their bridge pulse" on print_bridge_status
  for update to authenticated
  using (tenant_id in (select auth_tenants()))
  with check (tenant_id in (select auth_tenants()));
