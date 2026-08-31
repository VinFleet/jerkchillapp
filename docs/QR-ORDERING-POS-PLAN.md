# QR ordering, kitchen display and POS — scoped build plan

*22 Aug 2026. Written against the existing Jerk & Chill Ops codebase
(~25,800 lines, 40 screens, Next.js 16 + Supabase + PWA, deployed on Vercel).*

The reference product is a CodeCanyon item — "QR SaaS Menu based Contactless
Ordering and Order Management System: Admin, POS, Kitchen, Waiter". **Its page
returned 403, so this plan is written from the product title and from what a
system of that shape has to contain, not from its feature list.** Treat any
comparison as inference.

Its code is almost certainly PHP/Laravel, so nothing in it is reusable here.
Buying it and building this are alternatives, not complements.

---

## The honest starting position

You have already built the half these products usually lack.

| | |
|---|---|
| **Already built and beyond the reference** | 17 modules, food safety with legal compliance, suppliers, staff, licensing, stock, recipes, bookings |
| **Foundations that make the rest cheap** | station auth, role permissions, Supabase Realtime, Web Push, bilingual `Bi` component, PWA, repo-only storage access, a public-page pattern (`/book`) |
| **Genuinely new** | order model, QR menu, kitchen display, waiter flow, POS, payments, e-invoice, printing |

Two things that look done and are not:

- **Multi-tenant is plumbed, not real.** Storage namespaces on `jc:{tenant}:`
  and every synced table carries `tenant_id`, but `TENANT_ID` is a hardcoded
  constant. Structurally ready; one restaurant in practice.
- **PWA already installs on iOS and Android.** App Store presence is a
  Capacitor wrap — same codebase, a build step, two developer accounts. Not a
  rewrite, but not free either.

---

## Phase 1 — QR ordering and kitchen display

*The slice that earns its keep on its own. Roughly a fortnight.*

Nothing here touches money, so nothing here is regulated. That is deliberate:
it means Phase 1 can ship while the hard questions in Phase 3 are still open.

### 1.1 Order model

A new synced collection, `orders`, operational family (last-write-wins).

```
Order        id · tableId · status · placedAt · placedBy · channel · note
OrderLine    id · orderId · menuItemId · qty · unitPriceVnd · note · status
```

- Prices come from the **Menu module**, which is already the single source of
  truth across dine-in and delivery. Do not introduce a second price list.
- `status`: `placed → preparing → ready → served → closed`, plus `cancelled`.
- Line-level status as well as order-level, because a kitchen marks the chicken
  ready before the sides.
- Local-first like everything else: an order written on a dead connection still
  reaches the kitchen when the tablet reconnects.

### 1.2 QR menu — the guest side

A public route, `/order/[tableToken]`, modelled directly on `/book`: no login,
bilingual, light enough for bad 3G.

- One QR sticker per table, encoding a **token, not the table number** — a
  guessable `/order/I4` lets anyone order to any table from the street.
- Menu grouped by category, prices from the Menu module, allergen and heat
  flags if those get added.
- Cart, then submit. **No payment.** The order goes to the kitchen; payment
  happens as it does today.
- Rate-limit per token. An open ordering endpoint on the public internet will
  be found.

### 1.3 Kitchen display

A station screen at the pass, using Supabase Realtime, which is already wired.

- Columns: new · preparing · ready.
- Big targets, glanceable from a metre, same rules as every other kitchen
  screen in this app.
- Tap a line to advance it; tap the order to advance all of it.
- Audible alert on a new order, per-device setting, default on for kitchen.
- Age on every ticket — an order sitting eight minutes should look wrong.

### 1.4 Waiter flow

The FOH station already exists; this adds a screen to it.

- Table plan (I1–I11, O1–O3) with state per table: empty, ordering, food out,
  needs attention.
- Take an order on behalf of a guest — same component as the QR page, so there
  is one ordering UI rather than two that drift.
- See what has gone out and what is still coming.

**Phase 1 delivers:** guests order from the table, the kitchen sees it
instantly, waiters stop walking to the pass to ask. No payment, no printer, no
regulator.

---

## Phase 2 — Printing

*Optional. Phase 1 works without it — a screen at the pass is a valid KDS.*

The constraint decides the architecture: **your app is HTTPS on Vercel, LAN
printers are HTTP, and browsers block HTTPS→HTTP.** The tablet cannot talk to
the printer directly, whatever the printer supports.

| Option | How | Cost |
|---|---|---|
| **CloudPRNT** | Printer polls your app over HTTPS for jobs | A compatible printer (mainly Star) |
| **Local bridge** | A Pi pulls jobs and sends ESC/POS on TCP 9100 | ~$50, must stay powered |

Both look identical from the app: jobs queue in Postgres, something collects
them. Build it as an adapter so the transport can change without touching the
order code.

**Note for comparison:** Odoo solves this by printing from a server that sits
on the same LAN. That option is closed to a Vercel-hosted app, which is why
one of the two above is required.

---

## Phase 3 — POS

*Where the scope changes character. Do not start this without deciding §5.*

A till is not a screen. It is:

- shift open/close, float, cash drawer, blind counts
- voids, refunds, comps, discounts — each with a reason and an audit trail
- split bills, split by item, split by cover, merged tables
- service charge and VAT handling
- Z-report and X-report
- **payments** — regulated, needs a gateway, brings obligations you do not
  currently have
- **Vietnamese e-invoice (hóa đơn điện tử)** — legally required, integrated
  with the tax authority

The last two are the whole difficulty. Everything above them is ordinary work;
those two are a compliance project.

**Sapo already does all of this**, for a monthly fee, in Vietnamese, with
GrabFood and ShopeeFood connected and a documented Order API plus webhooks.

---

## The decision that shapes everything

**Is this a product you intend to sell, or a till for one restaurant?**

### If it is one restaurant

Stop after Phase 1 (and Phase 2 if you want tickets). Let Sapo be the till and
consume its webhooks:

```
Sapo ──(webhook: order paid)──▶ /api/sapo/webhook ──▶ repo
                                                       │
                          ┌────────────────────────────┼──────────────┐
                     Daily sales              Usage variance     Portion tracker
```

One route, one repo, one direction. Everything downstream already exists. You
get real sales data, e-invoice compliance and delivery integration without
building or maintaining any of it — and **Usage Variance becomes true**, which
is the single biggest analytical win available to this codebase.

### If it is a product

Then Phase 3 is unavoidable, and so is the multi-tenant work: real tenant
resolution, per-tenant RLS, onboarding, billing, per-tenant branding. That is
a company, not a feature — and the honest sequencing is Phase 1 → paying pilot
restaurants → Phase 3, not Phase 3 on speculation.

---

## Rough effort

Deliberately coarse. Anything finer would be false precision.

| Phase | Scope | Effort |
|---|---|---|
| 1 | Order model, QR menu, kitchen display, waiter flow | ~2 weeks |
| 2 | Printing adapter + transport | 2–4 days plus hardware |
| 3a | POS mechanics — shifts, splits, voids, reports | ~3–4 weeks |
| 3b | Payments integration | 2+ weeks, gateway-dependent |
| 3c | Vietnamese e-invoice | Unknown. Compliance-led, not code-led |
| — | Capacitor wrap for App Store / Play | ~1 week plus review time |
| — | Real multi-tenancy | ~2–3 weeks, and it touches everything |

---

## What I would do

**Build Phase 1.** It is genuinely useful on its own, it is unregulated, it
reuses most of what exists, and it is the part no POS gives you for free
because it is *your* menu, *your* tables and *your* bilingual staff.

**Let Sapo be the till.** Consume its webhooks. You get compliance, payments
and delivery integration for a monthly fee that is far below the cost of
building and maintaining them — and every hour saved goes into the operations
half, which is where this app is already differentiated.

**Revisit Phase 3 only if this becomes a product**, and only after real
restaurants are using Phase 1.

---

## Before Phase 1 starts

Three free things still outstanding from go-live, all of which Phase 1 assumes:

1. **Floor plan created** — Bookings → Manage tables. Ordering needs tables.
2. **VAPID keys in Vercel** — the kitchen alert rides on Web Push.
3. **Real staff names and PINs** — orders get stamped with whoever is working.
