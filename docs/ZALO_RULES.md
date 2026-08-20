# Zalo integration — working rules

Full specification: [`ZALO_API.md`](ZALO_API.md). Error data:
[`../src/lib/zalo/zalo-errors.json`](../src/lib/zalo/zalo-errors.json).

**In this repo:** the error classification is generated — run `npm run
gen:zalo-errors` after changing the JSON, never edit `src/lib/zalo/errorTable.ts`
by hand. The pure, credential-free parts (phone normalisation, the night
window, NFC, mention escaping, error classes) are covered by `npm run
test:zalo`.

Read the relevant section of `ZALO_API.md` before implementing an endpoint. Do not implement Zalo endpoints from memory or from web tutorials — most public Zalo examples predate the 2026-01-01 platform consolidation and are wrong.

## Hard invariants

These are not style preferences. Violating any one produces a runtime failure that is hard to diagnose.

1. **Auth header is bare `access_token:`** — never `Authorization: Bearer`, never `ZALO_OA_ACCESS_TOKEN`.
2. **The app secret goes in a `secret_key:` HTTP header** on token requests — not the body, not Basic auth.
3. **Refresh tokens are single-use and rotating.** Persist the new pair in a committed transaction *before* using the new access token. Losing it destroys the grant permanently and requires a human to re-consent in a browser.
4. **`error != 0` arrives with HTTP 200.** Never branch on HTTP status for application errors. Check `body.error !== 0` on every call.
5. **Webhook signatures are plain `sha256(appId + rawBody + timestamp + secret)` — NOT HMAC.** `appsecret_proof` *is* HMAC. Do not copy one into the other.
6. **Capture raw webhook body bytes before JSON parsing.** Re-serializing changes the digest and verification will never pass.
7. **Webhooks return 200 within 2 seconds.** Enqueue and ack. Consumers must be idempotent on `message.msg_id`.
8. **No sends 22:00–06:00 `Asia/Ho_Chi_Minh`** (`-234` / `-133`). Defer, do not fail. Add jitter or the 06:00 release trips the rate limit.
9. **Normalize text to NFC before every length check.** The same Vietnamese string is 43 or 55 chars depending on encoding form.

## Platform state (August 2026 — do not build against the old model)

- ZNS was folded into **ZBS Template Message** on 2026-01-01. Wire protocol unchanged.
- `/v3.0/oa/message/transaction` and `/v3.0/oa/message/promotion` were **shut down 2026-03-01**. Do not use them.
- The replacement is a ZBS template on one of two channels:
  - **by UID** → `POST https://openapi.zalo.me/v3.0/oa/message/template` (`price_uid`, usually cheaper, **no `tracking_id`**)
  - **by phone** → `POST https://business.openapi.zalo.me/message/template` (`price_sdt`, `tracking_id` required)
- Social API is login + name/avatar only. Friend list, invitable friends, and the share API were removed.
- **There is no OA sandbox.** `dev-openapi.zalo.me` is not real. Only ZBS development mode (admins only) sends safely.

## Choosing a send channel

```
Recent interaction ≤48h  → CS message, free
Recent interaction ≤7d   → CS message, billable
No interaction + have UID   → ZBS template by UID   (cheapest proactive option)
No interaction + have phone → ZBS template by phone
User is in an OA-owned group → group message (free, no quota)
Reach everyone → broadcast (Article payload only)
```

## Version is per-endpoint-family, not global

Do not "upgrade" v2.0 paths to v3.0. Both are current:

| v3.0 | v2.0 |
|---|---|
| `/v3.0/oa/message/cs`, `/message/template`, `/oa/user/*`, `/oa/group/*`, `/oa/quota/*` | `/v2.0/oa/upload/*`, `/oa/tag/*`, `/oa/conversation`, `/oa/message` (broadcast, anonymous, reactions), `/v2.0/article/*`, `/v2.0/mstore/*` |

`-240 MessageV2 API has been shut down` applies to the **message** API only.

## Conventions in this codebase

- OA `GET` endpoints take parameters as one JSON-encoded `data` query param: `?data={"user_id":"..."}`. ZBS `GET` endpoints use ordinary query params. They are different — do not unify them.
- Generate error handling from `zalo-errors.json`; do not transcribe error codes by hand.
- All IDs and `timestamp` values are **strings** and exceed 2^53. Never parse them as numbers in JavaScript.
- Uploaded `attachment_id` / `token` values **expire after 7 days**. Do not persist them as if permanent.
- The webhook signature ambiguity (`app_id` vs `oa_id` as first term) is unresolved. Verify against both, log which matched, and keep the metric until live traffic settles it.
- Group mentions are a string convention (`[@user_id]`). Strip that pattern from any relayed user text or you have an @everyone injection.

## Before marking Zalo work complete

- Errors classified into refresh / retry / reschedule / dead-letter — not one generic catch
- Token refresh tested under concurrency
- Webhook handler tested by replaying one event five times
- NFC and NFD fixtures of the same string produce the same validation verdict
- No secrets in source or client bundles
- Anything marked `⚠️ UNVERIFIED` in `ZALO_API.md` §23 is feature-flagged or confirmed against a real OA
