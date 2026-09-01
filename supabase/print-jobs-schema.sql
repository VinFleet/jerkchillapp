-- The print queue.
--
-- A browser cannot open a raw socket to a thermal printer, and an HTTPS page
-- cannot call http://192.168.x.x — so the app never talks to printers. It
-- writes a job here, and a small bridge process running on any machine inside
-- the restaurant (tools/print-bridge) claims jobs and speaks ESC/POS to the
-- printers over the LAN. Internet down means no auto-print, and the on-screen
-- print buttons remain the fallback.
--
-- Run once, in the Supabase SQL editor.

create table if not exists print_jobs (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null default 'jerk-and-chill-thao-dien',
  -- which physical printer class this goes to; the bridge maps it to an IP
  printer     text        not null check (printer in ('kitchen', 'receipt')),
  -- structured ticket data, rendered to ESC/POS by the bridge
  payload     jsonb       not null,
  status      text        not null default 'queued'
              check (status in ('queued', 'printing', 'done', 'failed')),
  error       text,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  done_at     timestamptz
);

-- The bridge polls "oldest queued first"; this is that read.
create index if not exists print_jobs_queue_idx
  on print_jobs (tenant_id, status, created_at);

alter table print_jobs enable row level security;

-- Signed-in devices enqueue and can see job state (the pad shows "printed").
drop policy if exists "staff can enqueue print jobs" on print_jobs;
create policy "staff can enqueue print jobs"
  on print_jobs for insert to authenticated
  with check (true);

drop policy if exists "staff can read print jobs" on print_jobs;
create policy "staff can read print jobs"
  on print_jobs for select to authenticated
  using (true);

-- Only the bridge (service role, bypasses RLS) claims and completes jobs.
