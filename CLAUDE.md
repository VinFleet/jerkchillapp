# Jerk & Chill — Restaurant Operations Web App

## What this is

A restaurant management web app for Jerk & Chill, a 26-seat Caribbean restaurant in Thảo Điền, District 2, Ho Chi Minh City. It replaces a full stack of standalone documents — Chef Recipe Book, Kitchen Food Safety Book, Daily Operations Book, Management Book, a marketing strategy and KOC outreach list, delivery-platform research — plus group chats for anything that doesn't fit a document. The goal is one system the whole team actually uses: kitchen, front of house, and the owner, not just the person who built the spreadsheets.

This is the complete spec. Build Phase 1 first (see "Build Order" near the end), but everything below is the full picture so later phases don't need re-briefing.

---

## Platform

**This is a responsive web app, not a native app.** Accessible through any browser — phone, tablet, laptop, desktop. No app store install required.

- Build as a PWA (installable to home screen, works offline where practical) so it *feels* like an app without app-store distribution.
- Mobile-first responsive design — most real usage is on a phone or tablet, standing up, mid-shift.
- Desktop/laptop view matters too, mainly for the Owner/Manager doing admin work (menu pricing, licensing calendar, reports).

## Brand

- **Primary color: `#003295`** — extracted directly from the real logo file (`logo.png`). This is the correct brand blue.
- **Logo:** `logo.png` — "JERK & CHILL" wordmark with a winking, sunglasses-wearing drumstick mascot. Use as the primary header/nav logo.
- **Pattern:** `pattern.png` — repeating drumstick-mascot tile, same blue, transparent background. Good for login screens, empty states, loading screens, or a subtle section background — not for busy working screens.
- No second brand color is confirmed. For status states (success/warning/error) use a neutral functional palette (green/amber/red) rather than inventing a brand color.
- Typography unspecified — pick a clean, highly-legible sans-serif (system font stack is fine) since this is a working tool, not a marketing site.

## Design Principles (non-negotiable)

- Big, obvious tap targets — used one-handed, standing up, mid-shift.
- Tap/select over typing wherever possible — checklists, stock counts, and logs should be mostly taps, not paragraphs.
- Bilingual English/Vietnamese, always on — not a settings toggle. Every label, button, and question needs both languages, equal visual weight.
- One question per screen: "what do I need to do right now?" — not a dashboard someone has to interpret.
- A new hire should be able to use the checklist and stock screens correctly on day one, without training. If it needs an explanation, it's too complicated.

## Foundation

| Requirement | Detail |
|---|---|
| Multi-tenant | Must support multiple restaurants, each fully isolated (own recipes, menu, cocktails, cost data, staff, contacts). A second Jerk & Chill location auto-populates from a shared template; a different-concept restaurant starts blank. Ingredient pricing can vary by location even on a shared recipe. |
| Currency | Vietnamese Dong (VND) as primary; design so other currencies aren't a rewrite later. |
| Compliance record-keeping | All food-safety logs must be timestamped, tamper-evident (edits logged, not silently overwritten), and exportable to PDF for a real inspection — legal requirement (QĐ 1246/QĐ-BYT, Circular 30/2012/TT-BYT), not optional. |

## User Roles & Permissions

Four fixed roles, enforced everywhere — not just hidden in the UI.

| Role | Sees | Doesn't see |
|---|---|---|
| **Owner** | Everything — recipes, all checklists, all food-safety logs, stock, production planner, cost & margin, EPOS data (once connected), notice board, wages, hiring, licensing calendar, marketing calendar. | Nothing. |
| **Manager** (incl. manager-in-training) | Recipe book, checklists, food-safety logs, stock, production planner, notice board, supplier management, contacts, menu/pricing, licensing calendar, hiring, marketing calendar. Can edit checklist items. | Cost & margin data and staff wages — default hidden until explicitly enabled. |
| **Chef / Kitchen** | Recipe book (view + scale), kitchen checklists, kitchen food-safety logs (enter data), stock (enter counts), production planner (view), notice board. | Cost data, pricing, EPOS data, wages, hiring, licensing, marketing. Can flag a recipe for manager review instead of editing directly. |
| **Bartender / FOH** | Bartender reference, cocktail recipes, FOH checklists, bar/FOH stock, customer complaint log (enter), notice board. | Kitchen costing, full recipe edit access, EPOS data, wages, hiring, licensing, marketing. |

**Open question:** should Manager eventually see cost/margin data once trust is built, or stay Owner-only indefinitely? Build the toggle, default it off.

---

## Full Module Spec — 16 modules across 4 phases

### Phase 1 — Core Daily Operations (build and prove this first)

**1. Digital Recipe Book**
- Every recipe, searchable by name.
- Tap to scale a recipe to any portion count, not just fixed tiers — auto-converts every ingredient.
- Method steps shown as a checklist chefs can tick through while cooking.
- Chefs can flag a recipe ("this needs updating") which notifies the manager instead of editing directly.

**2. Daily Stock & Production Log — digital**
- Opening Stock / Produced Today / Closing Stock columns, entered on tablet or phone.
- Auto-carries yesterday's Closing Stock into today's Opening Stock — no re-entry.
- Flags items with high leftover trends over time (e.g. "Mac and Cheese wasted 3 nights running").
- Par-level tracking for bar/drinks stock specifically (spirits, cocktail ingredients, beer, garnish) — On Hand vs. Par vs. To Order.
- Kitchen Prep & Production view — Mains/Sides/Desserts with Ready Now, Par (Tomorrow), and To Prep.
- Ties into cost tracker to show waste in VND, not just portions.

**3. Opening/Closing Checklists — digital**
- Tap-to-check items, same as paper, for both FOH and Kitchen.
- Manager sees in real time whether the checklist is done before service starts.
- New checklist items added by the manager instantly appear on every device — no reprinting.

**4. Production Planner**
- Pulls from the Stock Log to suggest what to produce today, based on recent Closing Stock trends.
- Chef confirms or overrides the suggested quantity before starting prep.
- Par-driven ordering suggestions — flags when Shopping List items are due for reorder.

**5. Centralised Notice Board**
- Replaces the group chat for anything operational — "we're out of X," "new supplier price," "table 4 special request."
- Manager posts to all devices at once; staff mark as read/acknowledged.

### Phase 2 — Food Safety, Compliance & Suppliers

**6. Food Safety Compliance Suite**
- Fridge & Freezer Temperature Log — every unit, checked twice daily, out-of-range readings flagged immediately.
- Cooking / Core Temperature Log — probe reading logged per batch, target ≥75°C/30 sec, flagged if under target.
- Delivery / Receiving Log — temperature, packaging, and use-by date checked and logged on arrival, plus a photo of the delivery and invoice; rejected deliveries logged with reason and supplier notified.
- Cleaning Schedule — area/item, frequency, signed off per day.
- Three-Step Food Inspection — before/during/before-serving checks logged every service (legally required, QĐ 1246/QĐ-BYT).
- Food Sample Retention — every dish served logged with quantity, time, storage location; weekly check confirms samples past the 24-hour minimum are discarded.
- Pest Control Log — sightings, location, action taken, reported status.
- Customer Complaint / Incident Log — especially allergy-related, tied to guest contact and investigation outcome.
- Every log here should be exportable as an inspector-ready record.

**7. Supplier Management**
- Approved Supplier List — registration on file, food-safety cert + expiry, other certs, last reviewed date, linked to Contacts Directory.
- Goods Rejection / Defect Record — logged against the relevant delivery, with photo, action taken, whether supplier was notified.
- Supplier Periodic Evaluation — annual quality/on-time/documentation review per supplier, feeding a continue/review/replace decision.
- Feeds the Shopping List — a supplier flagged for replacement surfaces there too.

**8. Contacts Directory**
- Centralised, categorised — Suppliers, Staff, Emergency Services, Building Management, and other categories as needed.
- Replaces scattered numbers in personal phones and group chats.
- Supplier entries link through to Supplier Management and the Shopping List.

**9. Licensing & Compliance Calendar**
- Every licence/certificate with a renewal date — Certificate of Eligibility for Food Safety (3-year), business registration, PCCC fire safety, annual water quality test (if applicable), pest control contract.
- Automatic reminders ahead of expiry.
- Owner/Manager only.

### Phase 3 — Money, People & Growth

**10. Daily Sales Entry**
- End-of-day sales entry, split by channel: Eat In, Takeaway, Shopee, Grab.
- Once EPOS integration exists (see Future Ideas), this could pull automatically instead of manual entry.
- Cash reconciliation against the POS Z-report, float tracking, bank-drop logging.
- Feeds the cost tracker so margin can be checked against real revenue.

**11. Staff — Wages, Scheduling, Certifications & Hiring**
- Staff rota — shift schedule per staff member, working hours logged, wages tracked against hours worked.
- Managers can email the rota directly to staff from the app — a real sendable schedule, not just an in-app view.
- Wage/hourly-rate data visible to Owner only by default.
- Digital staff induction checklist — contract signed, uniform issued, food-safety training logged, health certificate on file, POS access created.
- Code of Conduct acknowledgement — staff tick to confirm they've read it, timestamped.
- Disciplinary log — verbal/written/final warning steps recorded with date and detail, Owner/Manager only.
- Staff Training Record and Staff Health Certificate Tracker — per-person training topics and annual health-cert renewal dates, with reminders.
- Hiring & Recruitment — candidate tracker (CV storage, role applied for, status), a reusable question bank per role that can be tailored per candidate, and a bilingual scorecard template per interview.

**12. Menu & Pricing**
- Single live source of truth for every menu item and price — dine-in, delivery-app, and Lunch Rice Box pricing all pull from here instead of drifting out of sync across the printed menu, delivery listings, and internal documents.
- Menu & Printed Materials Stock — Par, On Hand, Reorder Point, To Reprint, plus printer/source and lead time.
- A price change here should trigger a flag that a menu reprint is needed.

**13. Marketing & Content Calendar**
- Weekly content rhythm — process/sensory, interior/vibe, Roast Sunday (framed as scarcity, e.g. "3 spots left"), Lunch Box — scheduled with reminders.
- KOC/Influencer Outreach Tracker — handle, platform, tier, contact status, comped-meal cost, whether content went live.
- Platform Campaign Tracker — entry windows for things like Grab's Top Restaurant Tournament or ShopeeFood's mega-sale placements.
- Performance tracking — saves/shares per post, tagged by pillar, so the team can see which pillar is actually working.

### Phase 4 — Ordering & Advanced (build once Phases 1–3 are proven in daily use)

**14. Weekly Shopping List / Ordering**
- Auto-generates from Stock Log par levels vs. on-hand counts, rather than a manually rebuilt list each week.
- Carries real supplier data per item — pack size, pack cost, and which supplier it's actually ordered from (never just one supplier: main grocery supplier for produce/dairy/dry goods/spices, a separate beer supplier, a separate liquor supplier, a local market for some produce, a separate ice supplier).
- Flags items still on unconfirmed placeholder pricing so they get chased to a real invoice price over time, and flags items that haven't been ordered in a long time as candidates for cleanup.

**15. Delivery Platform Performance**
- Tracks delivery platform stats — rating, cancellation rate, order-confirmation speed, % of menu items with photos — against each platform's free-placement badge criteria.
- Commission comparison across platforms in one place.
- Flags exactly what's blocking Preferred/Favorite status as a checklist, not an abstract goal.

**16. Theoretical vs. Actual Usage Reporting**
- Variance report: theoretical ingredient usage (Recipe Book cost/qty × units sold, from Daily Sales Entry) compared against actual usage (Stock Log Opening/Closing/Produced figures).
- Surfaces real waste and shrinkage, not just estimates.
- Phase 4 modules are modelled on established restaurant platforms (MarketMan, Restaurant365, MarginEdge, Toast/xtraCHEF, 7shifts, Deputy) — real, proven feature patterns, not guesses. Each depends on Phase 1–3 data already existing and being trustworthy.

---

## Devices & Access

- Dedicated tablet in the kitchen — main input station for stock counts, checklists, food-safety logs, production log.
- Staff's own phones — view-only or light input access (recipes, checklists), not tied to the tablet.
- Manager/owner access — full view across all modules, plus the cost/margin, wage, and licensing data others don't need to see.

## Open Questions (resolve as you go, don't block on these)

- Do staff need individual logins, or is one shared kitchen login enough for now?
- Offline support — kitchen wifi may not be reliable, and legally-required food-safety logs depend on it. This one matters more than the others; consider it early in the architecture even if full offline support comes later.
- Manager cost/margin and wage visibility — view-only once trusted, or Owner-only indefinitely?
- Hiring/candidate data sensitivity — who can see CVs, interview scores, salary negotiations? Default to Owner + Manager only.
- Who acts on Licensing Calendar reminders if the Owner's unavailable — does Manager also get alerted?
- Who owns the Marketing Calendar day to day — Manager task, or stays with Owner?

## Future Ideas (not in scope yet, don't build, just don't architect against them)

- EPOS integration — the restaurant's EPOS system may expose an API. If so, sales and order data could feed straight into the app instead of manual entry, letting the Stock Log and Production Planner compare what was actually sold against what was produced (real waste %), and giving the cost tracker real revenue numbers.

---

## Build Order

Don't build all 16 modules at once — build shallow-and-wide and nothing will actually work. Build in this order, and get each phase genuinely used in daily service before starting the next:

1. **Phase 1** (Modules 1–5) — core daily operations. This is the whole first build.
2. **Phase 2** (Modules 6–9) — food safety, compliance, suppliers.
3. **Phase 3** (Modules 10–13) — money, people, growth.
4. **Phase 4** (Modules 14–16) — ordering and advanced reporting.

## First message to send Claude Code

> Read CLAUDE.md in this folder for full context — it's the complete spec, but only build Phase 1 first (Modules 1–5: Digital Recipe Book, Daily Stock & Production Log, Opening/Closing Checklists, Production Planner, Notice Board). Set up a new React/Next.js project with Tailwind, configured as a PWA. Use `#003295` as the primary brand color and `logo.png` as the header logo. Every screen needs bilingual English/Vietnamese labels, mobile-first responsive layout, and big tap targets — this will be used one-handed on a phone mid-shift by staff with no training on the app. Build the role-permission system (Owner/Manager/Chef/Bartender) from the start, even if only Owner exists as a real login for now.

---

# VINPOS

The app is now a product: **VINPOS**, a restaurant POS-and-operations SaaS.
Jerk & Chill is customer number one and keeps its branding as branch data.

- **Org → branches.** `organizations` / `branches` / `org_members` in
  Postgres (`supabase/saas-schema.sql`); a branch id IS the tenant id. The
  legacy tenant `jerk-and-chill-thao-dien` was adopted as the first branch.
- **Isolation is RLS, not politeness.** Every tenant-scoped table's policies
  go through `auth_tenants()` — a member touches exactly the branches of
  their organizations. The permissive "any authenticated" policies are gone.
- **The client is tenant-blind.** Repos and sync key everything off
  `getActiveTenant()` (device-local); switching branch = set + full reload,
  and a fresh branch seeds itself like a new install. Server routes derive
  the tenant from data (a table token knows its restaurant) — never from a
  constant. Payments are per-branch: bank details sync as
  `payment_settings`, and each branch's webhook secret lives in
  `branch_secrets` — service-role only, because a synced row is readable by
  every member and this secret can forge paid confirmations. The env secret
  remains the legacy branch's fallback.
- **Branding is branch data.** Chrome, guest page and bill wear
  `receipt_settings` (name/logo); the legacy branch defaults to the J&C
  logo; new branches start neutral and show the VINPOS wordmark until named.

## The commercial rule that cannot be broken

The software is free forever. Revenue is setup engagements and monthly
support plans. **A lapsed or unpaid plan removes SUPPORT, never the
software** — the till never degrades, never goes read-only, never nags
mid-service. The admin console's suspend switch exists for abuse and legal
compulsion only; if a billing state ever gates an app feature, that change
is wrong regardless of who asked for it. Cost data and wages live in local
collections (not Postgres), so DB-level role policies for them do not apply
yet — revisit when any cost-bearing collection starts syncing.

# Architectural invariants

*Everything above is the original brief. Everything below is how the code
actually works — verified against the repository, not remembered. Breaking any
of these produces a failure that is hard to trace back to its cause.*

## The rules

1. **Local-first.** Every read comes from `localStorage`; every write lands
   there first. Supabase is a shared copy, never the source of truth during a
   shift. The app must stay fully usable with no network. The one deliberate
   exception is document uploads (§Documents below).

2. **`src/lib/repo/` is the only code that touches storage.** No screen or
   component reads `localStorage` directly. Repos are also the only place that
   knows key names.

3. **Food-safety collections are append-only.** Records are never edited or
   deleted, only superseded by a new record that points at the one it replaces.
   Postgres triggers enforce this, so an app-side path that assumes mutation
   will fail at the database rather than silently corrupt a legal record.

4. **Sync has two families with different merge rules.** Operational
   collections are last-write-wins; food-safety collections are an append-only
   union. A collection may register a `reconcile`, and the engine applies it on
   conflicts in *both* families — `order_payments` uses this so a slip photo
   attached on one device survives another device's copy of the same payment.
   Merge functions are pure and must stay unit-tested for convergence (any
   order reaches the same state) and idempotency (merging twice changes
   nothing).

5. **Reference data does not sync** — recipes, suppliers, contacts, fridge
   units, cleaning tasks. It seeds identically on every device, so syncing
   would add failure modes for no benefit.

6. **Seed-staleness rule.** If data is *not* user-editable, bump the storage key
   to reship it. If it *is* editable, write a targeted `isSeeded()`-guarded
   migration, so a corrected seed never overwrites something someone typed.

7. **Bilingual English/Vietnamese at equal weight, everywhere**, via the `Bi`
   component. Never a language toggle — half the team reads each.

8. **Stations, not personal logins.** The device signs in to a station once; the
   person is picked from a dropdown and stamped onto every record. A PIN is
   required only where the record is personally someone's.

9. **No cron or background jobs**, with one deliberate exception. Alerts ride
   on the action that produced them, and the device that caused an event is
   excluded from its own fan-out. The exception is `/api/cron/daily` (Vercel
   cron, 06:00 VN, `CRON_SECRET` bearer): it sweeps only the failures whose
   defining feature is that no action ever happens — a dead print bridge
   cannot announce itself, and a ticket that never printed has nobody left to
   notice it. It only reads what Postgres can see; local-first compliance
   reminders still ride on app-open.

## Layout

**18 modules:** recipes · stock · checklists · planner · notices · bookings ·
orders · foodSafety · suppliers · contacts · licensing · sales · staff · menu ·
marketing · shopping · deliveryPerformance · usageVariance.

`orders` covers all four roles, because a chef needs the pass and a waiter
needs the pad. The real boundary is money: `canTakePayment` is what keeps the
kitchen tablet away from closing a bill.

**63 local collections** across `src/lib/repo/`, namespaced
`jc:{tenant}:{key}`. That count excludes ten `isSeeded()` migration guards
and four device-local meta keys, which are storage but not collections.

**25 sync**, in the two families:

- *Last-write-wins:* `checklist_items`, `checklist_ticks`, `notices`,
  `notice_acks`, `stock_entries`, `orders`, `order_payments`, `menu_items`,
  `table_tokens`, `receipt_settings`, `printer_settings`, `payment_settings`,
  `einvoice_settings`, `fs_fridge_units_v2`, `recipes_v3`
- *Append-only:* `order_lines`, `fs_temp_readings`, `fs_cook_logs`, `fs_delivery_logs`,
  `fs_cleaning_signoffs`, `fs_inspections`, `fs_samples`,
  `fs_sample_destruction_checks`, `fs_pest`, `fs_complaints`

The order header is last-write-wins (one device owns it at a time, and it
holds nothing concurrent devices fight over); the LINES are individual
`order_lines` records in the append-only union family with a reconciler —
status only moves forward, a void is terminal, the kitchen keeps the earliest
send. Two offline waiters adding to one table produce disjoint records that
union with no conflict at all. Repos assemble `order.lines` at read time;
screens never see the split. Never re-embed lines into the order record.

## The guest's phone knows nothing

A guest opening `/order/<token>` is a stranger's browser: no local store of
ours, no Supabase session, no sync. Everything that page needs crosses the
network through `/api/order/[token]`, which reads `synced_records` with the
service role and writes the order back in exactly the shape a device would
have written locally — so the till pulls a guest's order down the same merge
path as a waiter's.

This is why `menu_items` and `table_tokens` sync despite being reference data
under rule 5: the server is the only thing that can answer "which table is
this, and what can they order", and `synced_records` is the only shared copy.
Syncing the menu also closed a quieter gap — a price the owner changed on
their laptop never used to reach the kitchen tablet.

The client posts an id and a quantity, never a price. Anything a guest can
send is something a guest can forge.

## Tables — the other exception to rule 1

The floor plan lives in Postgres, because the public booking form has to see it
and a guest's browser has no local store of ours. That is right for bookings
and wrong for the till, so `lib/repo/tableCache.ts` mirrors it locally on every
successful fetch and falls back to the compiled-in `STARTER_FLOOR_PLAN`. A
device that has never been online still knows the room.

## Documents — the exception to rule 1

Certificates and paperwork live in Postgres and Supabase Storage, not on the
device, and need a connection. A PDF is megabytes against a ~5MB localStorage
budget shared by every module, and a certificate uploaded on the owner's laptop
has to be visible on the kitchen tablet — which local storage cannot do, since
supplier records do not sync. Uploading paperwork is an office task done once,
not something anyone does mid-service.

## Where the judgement lives

Logic with a decision in it is kept import-free so it can be tested without a
browser, a network or credentials. Follow this pattern rather than reaching
into a repo from a test:

| Pure module | Decides |
|---|---|
| `lib/repo/dueTodayRules.ts` | which recurring checks are outstanding |
| `lib/zalo/capabilities.ts` | what the Official Account can do |
| `lib/zalo/sendWindow.ts` | whether a message type may send now |
| `lib/zalo/mentions.ts` | defusing `[@…]` injection in relayed text |
| `lib/zalo/text.ts` | NFC normalisation before any length check |
| `lib/repo/orderRules.ts` | what a bill totals, and whether a table may be closed |
| `lib/payments/vietqr.ts` | the EMVCo payload and its CRC — a wrong byte means a QR that will not scan |
| `lib/payments/webhookAuth.ts` | whether a payment callback is genuinely from the provider |
| `lib/payments/ninepay.ts` | the 9Pay card-terminal signature, and whether an IPN is genuine |
| `lib/repo/orderRules.ts` (`initialPaymentStatus`) | which payments settle at once and which wait for a callback |
| `lib/sync/collections.ts` (reconcilers) | how two devices' copies of one record merge — tested for convergence |

Tests: `npm run test:all` runs all eleven suites; individually
`npm run test:zalo`, `test:due`, `test:portions`, `test:orders`, `test:vietqr`,
`test:webhook`, `test:sync`, `test:escpos`, `test:pin`, `test:einvoice`,
`test:ninepay`.

## Printing

A browser cannot talk to a printer: no raw sockets, Chrome blacklists port
9100 outright, and an HTTPS page may not call `http://192.168.x.x`. The
NATIVE till app can — a Capacitor shell (`capacitor.config.ts`, android/,
ios/) around the deployed web app whose one plugin, TcpPrint, writes raw
bytes to a LAN socket. On the till, `deliver()` in `src/lib/print/jobs.ts`
prints direct (instant, internet-free) and `tillWorker.ts` claims queued
jobs from everyone else with the same CAS the bridge uses, so till + bridge
side by side never double-print. The web build still cannot, and never
pretends to: it queues. Docs: `docs/TILL-APP.md`. Printers are configured
in-app (Settings → Printing, the synced `printer_settings` record); the bridge
re-reads them every ~15s, with `printers.json` only as a fallback. Three
stations: kitchen, receipt, and an optional bar printer — when the bar is
enabled, drink categories (the same `DRINK_CATEGORIES` rule the kitchen
board's station filter uses) route there and one send becomes two tickets.
Cancelling a sent line prints a HUY/VOID ticket to the station that got the
original. The bridge heartbeats `print_bridge_status` every 15s; the review
screen checks it on open and warns BEFORE Send, and never-seen stays silent.
Per-printer `encoding`: default ASCII transliteration, or CP1258 for real
Vietnamese (tones as combining bytes; the ESC t page number is a setting
because firmware vendors disagree — 94, 30, 21 are all in the wild). Devices
(and the guest API, service-role side)
insert rows into `print_jobs` in Postgres; the native till's worker — or
`tools/print-bridge/bridge.mjs`, now optional, for setups that want a
dedicated print machine — claims jobs by compare-and-swap and speaks ESC/POS
to the LAN printers on port 9100. `src/lib/print/escpos.mjs` is the pure renderer, shared by app and bridge
(`npm run test:escpos`); text is transliterated to ASCII because cheap thermal
printers disagree about Vietnamese codepages, and readable-plain beats
mojibake. Jobs older than 15 minutes are failed, not printed — a bridge
started after lunch must not replay the morning. On-screen print pages remain
the no-bridge fallback. `print_jobs` is a server-side queue, not a synced or
local collection.

## Zalo, briefly

OA consent is **console-configured**, not request-built: `redirect_uri` and
`code_challenge` are saved settings and Zalo generates the consent link.
Building your own authorize URL returns `-14003`. PKCE is **one fixed pair**,
not one per request. Full detail in `docs/ZALO_RULES.md`; do not implement Zalo
endpoints from memory.

## Before changing anything here

Run `npx tsc --noEmit`, `npx eslint src/`, `npm run test:zalo`,
`npm run test:due`, and `npx next build`. The build type-checks the tests too,
so a test with a missing annotation fails the build rather than the test run.
