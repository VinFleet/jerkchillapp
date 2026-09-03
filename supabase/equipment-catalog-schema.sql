-- The fridge/freezer catalog, and the loop that grows it.
--
-- Every VINPOS branch needs its own fridges and freezers logged for the
-- Temperature Log — but which fridges are correct for THIS restaurant is not
-- reference data any one branch owns; it is a catalog the whole platform
-- shares. So it lives here, not in localStorage: any signed-in device can
-- read it (it is not tenant secret data), and only the platform adds to it.
--
-- A customer whose exact model is missing types it in anyway
-- (equipment_suggestions) — the app never blocks someone from logging their
-- real fridge just because we have not catalogued it yet. That row is a
-- signal to VINPOS, not a promise it becomes shared reference data; a
-- platform admin reviews it and decides whether to fold it into the catalog
-- for every future customer.
--
-- Run once, after saas-schema.sql (needs auth_tenants()).

create table if not exists equipment_catalog (
  id             text        primary key,
  category       text        not null check (category in ('fridge', 'freezer', 'combo')),
  brand          text        not null,
  model          text        not null,
  capacity_liters integer,
  target_min_c   numeric     not null,
  target_max_c   numeric     not null,
  notes          text,
  active         boolean     not null default true,
  created_at     timestamptz not null default now()
);

alter table equipment_catalog enable row level security;

-- Shared reference data: any signed-in device may read it, nobody but the
-- platform (service role, via the admin API) writes it.
drop policy if exists "signed-in devices read the catalog" on equipment_catalog;
create policy "signed-in devices read the catalog" on equipment_catalog
  for select to authenticated
  using (true);

create table if not exists equipment_suggestions (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null,
  category        text        not null check (category in ('fridge', 'freezer', 'combo')),
  brand           text        not null,
  model           text        not null,
  capacity_liters integer,
  note            text,
  submitted_by    text,
  status          text        not null default 'new'
                  check (status in ('new', 'added', 'dismissed')),
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);

create index if not exists equipment_suggestions_status_idx
  on equipment_suggestions (status, created_at);

alter table equipment_suggestions enable row level security;

-- A branch may submit its own suggestions and see how its own are getting
-- on; reviewing (changing status) is a platform action, done through the
-- admin API with the service role.
drop policy if exists "members submit equipment suggestions" on equipment_suggestions;
create policy "members submit equipment suggestions" on equipment_suggestions
  for insert to authenticated
  with check (tenant_id in (select auth_tenants()));

drop policy if exists "members see their own suggestions" on equipment_suggestions;
create policy "members see their own suggestions" on equipment_suggestions
  for select to authenticated
  using (tenant_id in (select auth_tenants()));

-- ---------- starter catalog ----------
--
-- Real brands and real capacity points sold into the Vietnamese F&B market
-- (Sanaky, Alaska, Sanden Intercool, Darling — domestic; Hoshizaki, True,
-- Turbo Air — imported, common in higher-end kitchens), at the granularity
-- that is actually verifiable: brand, product line, typical capacity. Not
-- claimed to be exhaustive — see equipment_suggestions above for how it
-- grows. `on conflict do nothing` so re-running this file never clobbers a
-- capacity or note an admin has since corrected.

insert into equipment_catalog (id, category, brand, model, capacity_liters, target_min_c, target_max_c, notes) values
  ('sanaky-vh-2599w1',  'freezer', 'Sanaky',          'VH-2599W1 (1 cua)',        208, -22, -18, 'Phổ biến cho quán nhỏ · Common for small kitchens'),
  ('sanaky-vh-4099w1',  'freezer', 'Sanaky',          'VH-4099W1 (1 cua)',        400, -22, -18, null),
  ('sanaky-vh-8699hy3', 'freezer', 'Sanaky',          'VH-8699HY3 (3 cua)',       860, -22, -18, 'Cỡ lớn, nhiều ngăn · Large, multi-door'),
  ('sanaky-vh-2899w1',  'fridge',  'Sanaky',          'VH-2899W1 (tu mat)',       280, 0, 5, null),
  ('alaska-kc-210',     'freezer', 'Alaska',          'KC-210',                   400, -22, -18, null),
  ('alaska-hb-15',      'freezer', 'Alaska',          'HB-15 (3 cua)',           1200, -22, -18, 'Cỡ lớn · Large'),
  ('alaska-lc-450',     'fridge',  'Alaska',          'LC-450 (tu mat)',          450, 0, 5, null),
  ('sanden-snc-0355',   'freezer', 'Sanden Intercool','SNC-0355 (mat kinh cong)', 330, -22, -18, 'Tủ trưng bày mặt kính · Curved-glass display'),
  ('sanden-sps-0350p',  'fridge',  'Sanden Intercool','SPS-0350P',                365, 0, 5, 'Phù hợp bếp nhỏ · Fits a small kitchen'),
  ('darling-df-1799wsi','freezer', 'Darling',         'DF-1799WSI',              1000, -22, -18, null),
  ('darling-dmf-9979',  'fridge',  'Darling',         'DMF-9979 (tu mat)',        800, 0, 5, null),
  ('hoshizaki-reachin-r','fridge',  'Hoshizaki',       'Reach-in (1 door)',            null, 0, 4, 'Imported — common in higher-end kitchens · Nhập khẩu')
on conflict (id) do nothing;
