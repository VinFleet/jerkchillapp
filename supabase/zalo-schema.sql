-- Jerk & Chill — Zalo token store
--
-- HOW TO RUN THIS:
-- 1. Open your Supabase project at supabase.com/dashboard
-- 2. Go to SQL Editor -> New query
-- 3. Paste this whole file and click Run
--
-- Only needed if you switch Zalo booking confirmations on. Safe to run now
-- and leave unused — it creates one locked-down table and nothing else.
--
-- WHY THIS TABLE EXISTS AND WHY IT IS LOCKED SO HARD
-- Zalo refresh tokens are single-use and rotating: every refresh invalidates
-- the previous one and issues a new pair. Lose the newest pair and the grant
-- is gone for good — an OA admin has to re-consent through a browser. So the
-- tokens live in Postgres rather than in memory or on a filesystem, where a
-- Vercel deploy or a cold start would drop them.
--
-- Holding a valid token here is equivalent to being able to send messages as
-- the restaurant, so unlike every other table in this project there is NO
-- policy granting access to signed-in staff. It is reachable only by the
-- service role, from server-side code the browser never runs.

create table if not exists zalo_tokens (
  -- 'oa' today. 'social' exists in Zalo's model but this app has no use for it.
  scope           text        not null,
  -- the OA id for scope='oa'
  subject_id      text        not null,
  access_token    text        not null,
  refresh_token   text        not null,
  access_expires  timestamptz not null,
  -- Used as a compare-and-swap guard so two serverless invocations cannot both
  -- spend the same single-use refresh token. See src/lib/zalo/tokens.ts.
  rotated_at      timestamptz not null default now(),
  primary key (scope, subject_id)
);

alter table zalo_tokens enable row level security;

-- Deliberately no policies. RLS with zero policies denies everyone, including
-- the authenticated staff login. The service role bypasses RLS by design, and
-- that is the only thing that should ever read this table.
--
-- If you are checking whether setup worked, do it from the SQL editor (which
-- runs as the owner), not from the app.

-- An append-only trail of rotations. When a grant mysteriously dies, this is
-- the only way to find out when it last worked and what happened next.
create table if not exists zalo_token_audit (
  id          bigserial primary key,
  scope       text        not null,
  subject_id  text        not null,
  event       text        not null,   -- 'exchange' | 'refresh' | 'refresh_failed'
  detail      text,
  created_at  timestamptz not null default now()
);

alter table zalo_token_audit enable row level security;
-- Same reasoning as above: service role only.

create index if not exists zalo_token_audit_lookup
  on zalo_token_audit (scope, subject_id, created_at desc);
