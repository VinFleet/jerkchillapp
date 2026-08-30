# Jerk & Chill Ops — integration brief for the combined EPOS project

*Prepared 22 Aug 2026. Written to be pasted into a new project that will
combine this restaurant operations app with a fully built EPOS.*

This is not a feature list — it is a map of **what exists, what to reuse, what
the EPOS should absorb, and the decisions that will bite you if you undo them
without knowing why.**

---

## 1. What this is

A production restaurant operations PWA, deployed and working, built for a
26-seat Caribbean restaurant in Thảo Điền, District 2, Ho Chi Minh City.

| | |
|---|---|
| Size | ~25,800 lines of TypeScript, 163 files |
| Surface | 40 screens, 7 API routes, 22 repos, 17 modules |
| Stack | Next.js 16 App Router · TypeScript · Tailwind v4 · PWA |
| Backend | Supabase — Postgres, Auth, Realtime, Storage |
| Deploy | Vercel |
| Dependencies | **six**: next, react, react-dom, @supabase/supabase-js, lucide-react, web-push |
| Tests | `test:zalo` (34) · `test:due` (8) · `test:portions` (9) — all pure, no browser or credentials |

Six runtime dependencies is deliberate. Everything else is written, so there
is nothing to inherit a breaking change from.

---

## 2. The three ideas everything rests on

Undo any of these and large parts stop making sense.

### Local-first, not offline-capable

Every read comes from `localStorage`; every write lands there first. Supabase
is a shared copy, never the source of truth during a shift. **The app is fully
usable with the router unplugged.** Kitchen wifi is unreliable and food-safety
logs are a legal requirement, so this is not a nicety.

*Implication for the EPOS:* if the EPOS is server-authoritative, the two have
different consistency models. Do not "fix" this app to match — decide at the
seam which system owns which data (see §5).

### Stations, not personal logins

Four chefs share one tablet. The **device** signs in to a station (Kitchen /
Front of house / Manager-Owner) once, at setup. The **person** is picked from a
dropdown and stamped onto every record. A PIN is required only where a record is
personally someone's — accepting the Code of Conduct.

Asking staff to log in and out per shift means they stop, and then every record
is signed by whoever logged in first.

*Implication:* an EPOS with per-user logins will want to be the identity
source. That is fine, but the station model must survive — a chef must not
have to authenticate to log a fridge temperature.

### Bilingual English/Vietnamese at equal weight

Every label, button and question, both languages, same size. Never a toggle —
half the team reads each. Enforced through a `Bi` component and `Bi`-typed
data.

*Implication:* any EPOS screen entering this app's world needs the same. A
Vietnamese till with an English ops app is the failure mode this project
exists to avoid.

---

## 3. The 17 modules

**Daily operations:** recipes (scalable, method-as-checklist) · stock &
production log · opening/closing checklists · production planner · notice board

**Compliance** (QĐ 1246/QĐ-BYT, Circular 30/2012/TT-BYT): food safety —
eight logs: fridge/freezer temperatures, cooking core temps, deliveries with
photos, cleaning schedule, three-step inspections, sample retention, pest
control, customer complaints · suppliers with certificate expiry · contacts ·
licensing calendar

**Money, people, growth:** daily sales entry by channel · staff (rota, wages,
induction, Code of Conduct, disciplinary, training, health certs, hiring) ·
menu & pricing · marketing calendar

**Ordering and analysis:** shopping list from par levels · delivery platform
performance · theoretical vs actual usage variance

**Bookings** sits outside the phases: a public page at `/book` with no login,
plus a staff floor plan (11 indoor I1–I11, 3 outdoor O1–O3).

---

## 4. Data model

### Local — 56 collections

`localStorage`, namespaced `jc:{tenant}:{key}`. Each has a repo in
`src/lib/repo/`, which is **the only code permitted to touch storage**. No
screen or component reads it directly.

**Seed-staleness rule:** if data is *not* user-editable, bump the storage key
to reship it. If it *is* editable, write a targeted `isSeeded()`-guarded
migration — a corrected seed must never overwrite something someone typed.

### Synced — 14 collections, two families

One generic Postgres table, `synced_records (tenant_id, collection, record_id,
data jsonb, deleted, updated_at)`.

**Operational, last-write-wins:** `checklist_items`, `checklist_ticks`,
`notices`, `notice_acks`, `stock_entries`. The most recent stock count is the
real one.

**Food safety, append-only union:** `fs_temp_readings`, `fs_cook_logs`,
`fs_delivery_logs`, `fs_cleaning_signoffs`, `fs_inspections`, `fs_samples`,
`fs_sample_destruction_checks`, `fs_pest`, `fs_complaints`.

Nothing is ever overwritten or deleted; a correction writes a new record
superseding the old. **Postgres triggers enforce this**, so it holds even
against someone with the shared password and a REST client. Last-write-wins
would be actively wrong here — two devices logging different fridge checks
would silently destroy one.

Merge functions are pure and tested for **convergence** (any order reaches the
same state) and **idempotency** (merging twice changes nothing).

**Reference data deliberately does not sync** — recipes, suppliers, contacts,
fridge units, cleaning tasks. It seeds identically everywhere.

### Documents — the one exception to local-first

Certificates and paperwork live in Postgres + Supabase Storage and need a
connection. A PDF is megabytes against a ~5MB localStorage budget shared by
every module, and a certificate uploaded on the owner's laptop must be visible
on the kitchen tablet — which local storage cannot do, since supplier records
do not sync. Uploading paperwork is an office task done once.

---

## 5. The seams — where the EPOS meets this

This is the section that matters. Each row is a decision the combined project
has to make deliberately.

| Area | This app has | EPOS will have | Recommendation |
|---|---|---|---|
| **Menu & prices** | Full module, one source of truth across dine-in and delivery channels | Its own catalogue | **EPOS owns it.** This app reads. Two price lists is the exact drift this module was built to stop |
| **Sales** | Manual end-of-day entry by channel, cash reconciliation, float, bank drop | Every transaction, natively | **EPOS owns it.** Delete the manual entry path; keep reconciliation and bank drop, which a till does not cover |
| **Table plan** | 14 tables with x/y positions, live availability, public booking | Almost certainly its own | **Pick one, delete the other.** Two floor plans that disagree is worse than either |
| **Stock / portions** | Opening–produced–closing per item per day, with prep categories | Depletion per sale, if it does recipes | **Both, joined.** EPOS gives what sold; this gives what was made and what was left. That join *is* usage variance |
| **Usage variance** | Built, currently on estimates | — | **Keep. It becomes real** the moment EPOS sales arrive. This is the single biggest win of combining them |
| **Recipes** | Scalable, method-as-checklist, chef flagging | Maybe cost-only | **Keep this one.** A till's recipe model is for costing; this one is read while cooking |
| **Food safety** | Eight logs, append-only, PDF export, legally required | Nothing | **Keep entirely.** No EPOS does this |
| **Staff** | Rota, wages, induction, PIN, health certs, hiring | Clock-in, maybe | **Merge carefully.** Identity from EPOS, everything else here |
| **Bookings** | Public page + staff view | Maybe | **Keep**, unless the EPOS has a real reservations product |
| **Notifications** | Web Push + Zalo group + in-app | Unlikely | **Keep entirely.** See §7 |

### The integration shape I would build

The EPOS emits order/sale events. This app consumes them at a single seam:

```
EPOS  ──(webhook: order paid)──▶  /api/epos/webhook
                                        │
                                writes through a repo
                                        │
                        ┌───────────────┼───────────────┐
                   Daily sales    Usage variance   Portion tracker
```

One route, one repo, one direction. Everything downstream already exists and
needs no changes — which is the point of having kept storage access inside
`src/lib/repo/`.

---

## 6. Deliberate constraints — do not "fix" these

Things most likely to be read as gaps by someone new to the codebase.

- **No cron or background jobs.** Alerts ride on the action that produced them,
  and the device that caused an event is excluded from its own fan-out. Simpler,
  and alerts arrive immediately rather than on a sweep. *(One exception is
  planned but not built: a daily sweep for obligations whose trigger is an
  absence — a check nobody did, a licence quietly expiring.)*
- **Reference data does not sync.** Identical seeds everywhere; syncing adds
  failure modes for no gain.
- **Food-safety records cannot be edited or deleted, only superseded.** Legal
  requirement, enforced in Postgres, not trusted to the UI.
- **Kitchen and FOH stations have no password; manager does.** The device is
  physically in the restaurant. What the manager station additionally sees —
  wages, cost margins — is what justifies the friction.
- **Cost/margin hidden from Manager by default**, with a toggle. The original
  brief asked for the question to be left open rather than answered.
- **Logic with a judgement in it lives in import-free modules** so it can be
  tested without a browser, network or credentials:
  `dueTodayRules.ts`, `portionTrackerRules.ts`, `zalo/capabilities.ts`,
  `zalo/sendWindow.ts`, `zalo/mentions.ts`, `zalo/text.ts`.

---

## 7. Vietnam-specific knowledge worth carrying over

Hard-won. Each of these cost real time to establish.

### Zalo

- **OA consent is console-configured, not request-built.** `redirect_uri` and
  `code_challenge` are *saved settings*; Zalo generates the consent link.
  Building your own authorize URL returns `-14003` regardless of domain
  verification. `/v4/oa/permission` appears nowhere in Zalo's OA docs because
  you are not meant to construct it.
- **PKCE is ONE FIXED PAIR** for the OA flow, not one per request. Per-request
  is correct for the Social flow and fails at token exchange on OA.
- **The night restriction is per message type, not a blanket ban.** Group chat
  and consultation messages send 24/24. Only promotional sends are blocked
  (`-234`). Transaction messages send at any hour but their push is suppressed
  outside 06:00–21:59.
- **Auth is a bare `access_token:` header**, never `Authorization: Bearer`. The
  app secret travels in a `secret_key:` header on token requests.
- **`error != 0` arrives with HTTP 200.** Never branch on HTTP status.
- **Refresh tokens are single-use and rotating.** Persist the new pair before
  using the access token, or the grant is lost and a human must re-consent.
- **Group mentions are a string convention** (`[@user_id]`), not a structured
  field — relayed user text must be escaped or you have an @everyone injection.
- Full detail: `docs/ZALO_RULES.md`, `docs/ZALO_API.md`,
  `docs/ZALO-14003-RESOLUTION.md`, and a generated error table from
  `src/lib/zalo/zalo-errors.json`.

### Vietnamese text

**Normalise to NFC before every length check.** The same visible string is 43
or 55 characters depending on encoding form, and **iOS produces the decomposed
form**. Guest names come from phones. A name that passes validation locally
arrives at an API over the limit, failing only for particular guests — so it
reads as a flaky API rather than a bug. `zalo/text.ts` handles this and is
tested.

### Phone numbers

Vietnamese numbers must be `84…`, no leading zero. `zalo/phone.ts` normalises
every form people actually type, including the wrong-but-common `+84 0987…`.
Reuse it rather than writing a second implementation.

### Compliance

Food-safety records are a legal requirement under QĐ 1246/QĐ-BYT and Circular
30/2012/TT-BYT: timestamped, tamper-evident, exportable for an inspection.
Research suggests inspectors expect the physical signed book, and no instrument
appears to authorise an electronic record in its place — so the app should
**produce** the paper record, not claim to replace it.

Vietnam requires **e-invoices (hóa đơn điện tử)**. This app does not do them and
should not; that is squarely EPOS territory.

---

## 8. Current state, honestly

**Working and deployed:** all 17 modules · bookings (public + staff) · station
login with PIN · multi-device sync · food-safety PDF export · document and
certificate uploads · Zalo OA connected.

**Configured:** Supabase (schema, sync, RLS, storage, documents) · Vercel ·
domain verified with Zalo · owner login with role claim.

**Known gaps, in priority order:**

1. **PINs are stored in plain text.** Should be hashed and never synced.
2. **`PhotoRef.thumb` is a base64 data URL inside the record** — 20–40KB each
   against a ~5MB budget. Belongs in IndexedDB. A `signature` PNG data URL on
   delivery logs has the same problem.
3. **Food-safety records are never pruned locally** — correct for compliance,
   but unbounded localStorage growth (roughly 4–15MB/year).
4. **One shared station login**, so Postgres RLS cannot distinguish a
   bartender's session from a manager's; role enforcement for those cases is in
   the app, not the database. Three station accounts with role claims would
   close it.
5. **No corrective-action records.** The app logs that a fridge hit 9°C but not
   what anyone did about it — which is exactly what an inspection asks for.
6. Web Push built and tested but VAPID keys not yet set, so no phone alert has
   ever been delivered.
7. Seven placeholder staff names; empty floor plan until a one-tap seed.

A 23-prompt build queue addressing most of these exists separately.

---

## 9. Repository map

```
src/
  app/
    (app)/…            40 screens, role-gated
    api/zalo/…         connect · callback · status · booking-confirmation
    api/push/…         subscribe · send · test
    book/              public booking page, no login
    login/             station picker
  components/          shared UI (AppShell, WhoIsWorking, PinGate, Bi,
                       DocumentUploader, PortionTracker, …)
  lib/
    repo/              22 repos — the only code that touches storage
    seed/              13 seed files, real restaurant content
    sync/              collections · engine · provider
    zalo/              config · pkce · tokens · oa · group · zns · errors
    push/              client · server · categories · alert
    documents/         repo · types
    auth/              RoleContext · permissions · stationAuth
    bookings/          repo · types
supabase/              schema · sync-schema · push-schema · zalo-schema ·
                       documents-schema
docs/                  ZALO_API · ZALO_RULES · ZALO-14003-RESOLUTION ·
                       APP-ARCHITECTURE
CLAUDE.md              original brief + architectural invariants
```

---

## 10. If you read only one thing

The four decisions that carry the most weight, and the reason for each:

1. **Local-first** — because a food-safety log that fails on bad wifi is a legal
   problem, not an inconvenience.
2. **Stations, not logins** — because four chefs sharing a tablet will not sign
   in and out, and pretending otherwise means every record is signed by the
   wrong person.
3. **Food safety is append-only, enforced in the database** — because an
   app-side rule is a convention and this needs to be a guarantee.
4. **Bilingual at equal weight, never a toggle** — because half the team reads
   each language, and a toggle means somebody is always reading their second.
