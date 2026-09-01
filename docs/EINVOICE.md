# E-invoicing (hoá đơn điện tử) — status and plan

## Why this exists

Decree 123/2020/NĐ-CP (as amended by Decree 70/2025/NĐ-CP, in force June
2025) requires food-and-beverage businesses above the revenue threshold to
issue electronic invoices generated from a cash register connected to the
tax authority, through a licensed provider. Until a branch is integrated,
its printed bill must say — and does say — **PHIẾU TÍNH TIỀN — KHÔNG PHẢI
HOÁ ĐƠN** (bill, not a tax invoice).

## What is built (skeleton, flag off)

| Piece | Where | State |
|---|---|---|
| Invoice model + VAT arithmetic | `src/lib/einvoice/types.ts` | Done, tested (`npm run test:einvoice`). VAT is *extracted* from gross (prices are VAT-inclusive); discount reduces the taxable amount; whole-VND rounding. |
| Provider seam | `EInvoiceProvider` interface | Done — `configured()` + `issue()`, retryable vs terminal failures. |
| MISA driver | `src/lib/einvoice/misa.ts` | Stub. Refuses rather than pretends: the real endpoints/payloads must come from MISA's current docs + a sandbox account, not memory. |
| Branch setting | `einvoice_settings` (synced singleton) | Done — enabled (default **false**), provider, VAT rate. Credentials deliberately not here. |
| Queue | `supabase/einvoice-schema.sql` → `einvoice_jobs` | Done — till enqueues a frozen `EInvoiceRequest` at close; unique per (tenant, order) so retries update, never duplicate. RLS: members enqueue/read their branch; only the service-role worker writes results. |
| Enqueue at close | `src/lib/einvoice/queue.ts`, called from the review screen's close | Done — no-op while disabled or without a seller tax code. |

## What is NOT built, on purpose

- **The worker.** Nothing drains `einvoice_jobs` yet. Issuing needs provider
  credentials the till must never hold, so it is server work (natural home:
  a step in `/api/cron/daily`, or an explicit admin action for same-day
  issuing).
- **The MISA calls.** Needs from the customer/provider:
  1. meInvoice service account (appId + license) for the seller's tax code
  2. Registered invoice template & serial (mẫu số / ký hiệu)
  3. Current API docs + sandbox
  Then: implement `misa.ts`, store per-branch credentials in a
  service-role-only `einvoice_credentials` table (sketched in the SQL file),
  and add the worker.
- **A settings UI.** The flag ships off with no switch on screen; flipping a
  branch on is a deliberate act done together with the credential setup, not
  a toggle someone finds.

## The rule that holds throughout

The bill label ("KHÔNG PHẢI HOÁ ĐƠN") only comes off a branch's paper when
that branch actually issues real invoices — the label and the integration
must flip together, per branch, never globally.
