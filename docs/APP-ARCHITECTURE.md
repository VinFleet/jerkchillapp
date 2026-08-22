# Jerk & Chill Ops — how the app works

A restaurant operations PWA for a 26-seat Caribbean restaurant in Thảo Điền,
District 2, Ho Chi Minh City. Replaces a stack of paper books — Chef Recipe
Book, Kitchen Food Safety Book, Daily Operations Book, Management Book — plus
the group chats used for everything that didn't fit a book.

**Scale:** ~24,500 lines of TypeScript across 154 files. 37 screens, 7 API
routes, 17 modules, 56 local data collections, 14 synced collections.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · PWA ·
Supabase (Postgres + Auth + Realtime + Storage) · deployed on Vercel.

---

## 1. The three ideas the whole thing rests on

### Local-first, not offline-*capable*

Kitchen wifi is unreliable and food-safety logs are legally required, so every
read comes from `localStorage` and every write lands there first. Supabase is a
*shared copy* that devices push to and pull from — never the source of truth
during a shift. The app is fully usable with the router unplugged.

Consequence: a device that has never been online still works. A device that
goes offline mid-service keeps working and reconciles later.

### Stations, not personal logins

Four chefs share one tablet on the pass. Asking each of them to sign in and out
would mean they stop, and then every record is signed by whoever logged in
first.

So the **device** signs in to a station (Kitchen / Front of house /
Manager-Owner) once, at setup. The **person** is picked from a dropdown inside
the app, and everything logged from then on carries that name. A PIN is required
only for things that are personally someone's — accepting the Code of Conduct —
where one person tapping on another's behalf would make the record worthless.

The picker refuses to close until a name is chosen: a temperature reading signed
by nobody is not a record.

### Bilingual, always on

Every label, button and question appears in English and Vietnamese at equal
weight. Not a settings toggle — half the team reads one, half the other.

---

## 2. Roles and what they gate

Four roles, derived from the station rather than chosen:

| Station | Role | Sees |
|---|---|---|
| Kitchen | `chef` | Recipes, kitchen checklists, kitchen food-safety logs, stock, planner, notices, suppliers |
| Front of house | `bartender` | Bar reference, FOH checklists, bookings, bar stock, complaints log, notices |
| Manager / Owner | `owner` | Everything, including cost/margin, wages, licensing, marketing, hiring |

Manager and Owner are the same person here, so the manager station carries owner
permissions rather than the reduced manager set.

Enforcement is in three layers: module access (`canAccessModule`), per-action
checks (`canSeeWages`, `canEditFloorPlan`, `canConfirmPlanner`, ~20 of them),
and Postgres RLS for anything that reaches Supabase. Cost/margin visibility for
Manager is a toggle, default off.

---

## 3. The 17 modules

**Phase 1 — daily operations**

| Module | What it does |
|---|---|
| **Recipes** | Every recipe, searchable, scalable to any portion count. Method steps are a checklist chefs tick while cooking. Chefs flag a recipe for review rather than editing. |
| **Stock & production log** | Opening / Produced / Closing per item. Yesterday's closing auto-carries into today's opening. Flags high-leftover trends. Par tracking for bar and kitchen supplies. |
| **Checklists** | Opening/closing for FOH and Kitchen. Tap to tick. Manager sees completion live. New items appear on every device without reprinting. |
| **Production planner** | Suggests today's prep from recent closing-stock trends. Chef confirms or overrides. Booking-aware. |
| **Notice board** | Replaces the group chat for operational messages. Urgent notices interrupt with a sticky banner requiring per-person acknowledgement. |

**Phase 2 — compliance** (legally required: QĐ 1246/QĐ-BYT, Circular 30/2012/TT-BYT)

| Module | What it does |
|---|---|
| **Food safety** | Eight logs: fridge/freezer temperatures, cooking core temps, deliveries (with photos), cleaning schedule, three-step inspections, food sample retention, pest control, customer complaints. All timestamped, tamper-evident, PDF-exportable for an inspection. |
| **Suppliers** | Approved supplier list with certificate expiry, goods rejection records, periodic evaluation, price quotes for comparison. |
| **Contacts** | Categorised directory — suppliers, staff, emergency services, building management. |
| **Licensing** | Every licence with a renewal date and advance reminders. |

**Phase 3 — money, people, growth**

| Module | What it does |
|---|---|
| **Sales** | End-of-day entry split by channel (eat-in, takeaway, Shopee, Grab), cash reconciliation, float, bank drop. |
| **Staff** | Rota, hours, wages (owner-only), induction checklist, Code of Conduct with PIN acknowledgement, disciplinary log, training records, health certificates, hiring pipeline with scorecards. |
| **Menu & pricing** | Single source of truth for every price across dine-in and delivery apps. Price change flags a reprint. |
| **Marketing** | Content calendar, KOC/influencer tracker, platform campaign windows. |

**Phase 4 — ordering and analysis**

| Module | What it does |
|---|---|
| **Shopping list** | Auto-generates from par vs on-hand. Real supplier, pack size and pack cost per item. Flags placeholder pricing. |
| **Delivery performance** | Platform stats against each platform's badge criteria; commission comparison. |
| **Usage variance** | Theoretical usage (recipes × units sold) vs actual (stock counts) — real waste and shrinkage. |

**Bookings** sits outside the phases: a public booking page (`/book`, no login)
plus a staff floor-plan view with live availability.

---

## 4. Data model

### Local

56 collections in `localStorage`, namespaced `jc:{tenant}:{key}`. Each has a
repo in `src/lib/repo/` — the only place that touches storage. Seed data lives
in `src/lib/seed/` and is real content from the restaurant's actual books, not
lorem.

**Seed-staleness rule:** if data is *not* user-editable, bump the storage key to
reship it. If it *is* editable, write a targeted `isSeeded()`-guarded migration
so a corrected seed never overwrites something someone typed.

### Synced

One generic Postgres table, `synced_records (tenant_id, collection, record_id,
data jsonb, deleted, updated_at)`. Fourteen collections sync, in two families
with genuinely different merge rules:

**Operational — last-write-wins.** `checklist_items`, `checklist_ticks`,
`notices`, `notice_acks`, `stock_entries`. The most recent stock count is the
real one.

**Food safety — append-only union.** `fs_temp_readings`, `fs_cook_logs`,
`fs_delivery_logs`, `fs_cleaning_signoffs`, `fs_inspections`, `fs_samples`,
`fs_sample_destruction_checks`, `fs_pest`, `fs_complaints`. Nothing is ever
overwritten or deleted; a correction writes a new record superseding the old.
Last-write-wins would be actively wrong — two devices logging different fridge
checks would silently destroy one. **Postgres triggers enforce this**, so it
holds even against someone with the shared password and a REST client.

Reference data (recipes, suppliers, contacts) deliberately does *not* sync — it
seeds identically everywhere, so syncing would add risk for no benefit.

Merge functions are pure and unit-tested for **convergence** (two devices reach
the same state regardless of order) and **idempotency** (merging twice changes
nothing).

---

## 5. Notifications

Three channels, deliberately different jobs.

| Channel | Cost | Reaches | Works after 22:00 |
|---|---|---|---|
| **In-app banner** | free | anyone with the app open | yes |
| **Web Push** | free | the phone, app closed | yes |
| **Zalo group** | package | the team's Zalo | yes (group messages are exempt) |
| **Zalo ZNS** | ~800đ/msg | a guest's phone by number | sends, but no push at night |

Staff choose their own categories — shopping, bookings, problems, food safety,
checklists, urgent notices — on their own phone. Defaults are food safety and
urgent notices only; everything else is opt-in, because someone alerted about
things that aren't their job stops reading alerts entirely.

Alerts fire from the action that caused them (no cron), and the device that
caused it is excluded from the fan-out.

---

## 6. Integrations

**Supabase** — Postgres, Auth (station logins), Realtime (a manager's phone sees
a kitchen tick immediately), Storage (full-resolution delivery photos in a
private bucket; a ~320px preview stays in the record so every device sees the
evidence offline).

**Zalo Official Account** — connected via a console-configured OAuth flow.
Group messages for staff alerts (free, no quota, no night restriction); ZNS
templates for guest booking confirmations (paid, needs a funded Cloud Account).
Currently connected but gated: the OA is on the Basic package, and group
messaging needs Advanced or Premium.

**Web Share API** — a Share button drops the rota, shopping order or a notice
into any Zalo chat with one tap. Free, no API, works today.

**PosApp (EPOS)** — not built. Their Open API is real but paid and
password-gated; the free path is an Excel export that carries per-item and
per-channel breakdowns, which is exactly what Sales and Usage Variance need.

---

## 7. Deliberate constraints

Things that look like gaps but are decisions:

- **No cron or background jobs.** Alerts ride on the action that produced them.
  Simpler, and they arrive immediately rather than on the next sweep.
- **Reference data doesn't sync.** Identical seeds everywhere; syncing adds
  failure modes for no gain.
- **Food-safety records can't be edited or deleted, only superseded.** A legal
  requirement, enforced in Postgres rather than trusted to the UI.
- **The manager station needs a real password; kitchen and FOH don't.** The
  device is physically in the restaurant. What the manager station additionally
  sees — wages, cost margins — is what justifies the friction.
- **Cost/margin hidden from Manager by default**, with a toggle, because the
  spec asked for the question to be left open rather than answered.

---

## 8. Current state

**Working and deployed:** all 17 modules, bookings (public + staff), station
login with PIN, multi-device sync, food-safety PDF export, Zalo OA connected.

**Configured:** Supabase (schema, sync, RLS, storage), Vercel, domain verified
with Zalo, owner login with role.

**Not yet done:**

- Web Push keys not in Vercel — nobody receives phone alerts yet
- Staff are seven placeholder names with no PINs
- Floor plan is empty, so bookings can't seat anyone
- Zalo group needs a package upgrade, all staff following the OA, and a new
  OA-created group (an existing group cannot be posted to)
- No PosApp import
- One shared station login rather than per-person Supabase accounts, so
  Postgres RLS can't distinguish a bartender's session from a manager's —
  role enforcement for those cases is in the app, not the database

---

## 9. Repository map

```
src/
  app/
    (app)/…            37 screens, role-gated
    api/zalo/…         connect · callback · status · booking-confirmation
    api/push/…         subscribe · send · test
    book/              public booking page, no login
    login/             station picker
  components/          13 shared (AppShell, WhoIsWorking, PinGate, Bi, …)
  lib/
    repo/              17 repos — the only code that touches storage
    seed/              13 seed files, real restaurant content
    sync/              collections · engine · provider
    zalo/              config · pkce · tokens · oa · group · zns · errors
    push/              client · server · categories · alert
    auth/              RoleContext · permissions · stationAuth
    bookings/          repo · types · staff auth
supabase/              schema · sync-schema · push-schema · zalo-schema
docs/                  ZALO_API · ZALO_RULES · this file
```

**Testing:** `npm run test:zalo` — 34 tests over the credential-free logic
(phone normalisation, send windows, NFC, mention-injection, error classes,
PKCE, capability gating). Sync merge rules have their own convergence and
idempotency tests.
