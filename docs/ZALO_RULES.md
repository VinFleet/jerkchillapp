# Zalo integration — working rules

Full specification: `ZALO_API.md`. Error data: `zalo-errors.json`. End-to-end check: `zalo-smoke-test.py`.

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
8. **The night window is per message type — not a blanket ban.** CS replies and group messages send **24/24**; never defer them. Only promotional sends are blocked (`-234`). Transaction messages send at any hour but their **push is suppressed outside 06:00–21:59**, so they arrive silently. Defer with jitter or the 06:00 release trips the rate limit.
9. **OA consent is console-configured, not request-built.** `redirect_uri` and `code_challenge` are saved at **Sản phẩm → Official Account → Thiết lập chung**; Zalo generates the consent link. Building your own authorize URL → `-14003`. A per-request PKCE pair → later failure at token exchange. The Social flow is the opposite: per-request is correct there.
10. **Normalize text to NFC before every length check.** The same Vietnamese string is 43 or 55 chars depending on encoding form.

## Platform state (August 2026 — do not build against the old model)

- ZNS was folded into **ZBS Template Message** on 2026-01-01. Wire protocol unchanged.
- `/v3.0/oa/message/transaction` and `/v3.0/oa/message/promotion` were **shut down 2026-03-01**. Do not use them.
- The replacement is a ZBS template on one of two channels:
  - **by UID** → `POST https://openapi.zalo.me/v3.0/oa/message/template` (`price_uid`, usually cheaper, **no `tracking_id`**)
  - **by phone** → `POST https://business.openapi.zalo.me/message/template` (`price_sdt`, `tracking_id` required)
- Social API is login + name/avatar only. Friend list, invitable friends, and the share API were removed.
- **There is no OA sandbox.** `dev-openapi.zalo.me` is not real. Only ZBS development mode (admins only) sends safely.

## OA console setup — the order that unblocks OAuth

Each step has its own error. Check in order before debugging anything else.

| # | Step | Console path | Error if missing |
|---|---|---|---|
| 1 | Activate the app | Quản lý ứng dụng → Cài đặt → *"Chưa kích hoạt"* → *"Đang hoạt động"* | `-209`, `-14002` |
| 2 | Register the OA API product | Quản lý ứng dụng → Đăng ký sử dụng API → Official Account API | `-212` |
| 3 | Verify domain / URL prefix | Quản lý ứng dụng → Xác thực domain | — |
| 4 | Save callback + challenge | **Sản phẩm → Official Account → Thiết lập chung** → `Official Account Callback Url`, `Code Challenge` | **`-14003`** |
| 5 | OA admin grants | the console-generated consent link | `-223` |

`-14xxx` codes come from `oauth.zaloapp.com` and are **not** in `zalo-errors.json` — that file covers runtime APIs. `-14002` = app not activated (or clicker is not an app admin); `-14003` = redirect_uri does not match the saved callback. Log the full error body; `error_name` is the only signal Zalo gives.

Changing the callback URL **or** the permission set invalidates the grant and forces re-consent. Tick every group you will need the first time.

**Stuck?** Tools & Support → **API Explorer** → OA Access Token → Allow gives you a working access + refresh token pair without the consent flow. Seed the token store with it and build everything else.

## Send windows — branch on message type, do not block everything

| Type | Send | Push | Blocked with |
|---|---|---|---|
| Consultation / CS | 24/24 | 24/24 | never |
| Group chat (GMF) | 24/24 | 24/24 | never |
| Transaction (ZBS UID Tag 1/2) | 24/24 | 06:00–21:59 | never — but arrives silently at night |
| Promotional / broadcast (Tag 3) | 06:00–21:59 | 06:00–21:59 | `-234` |
| ZBS by phone | per-template flag | — | `-133` |

Timezone is **not documented** by Zalo — `Asia/Ho_Chi_Minh` is an assumption. `-133` is absent from the new ZBS error table and may be dead. **Whether OTP templates are exempt at night is unknown — test it before shipping nighttime auth, and keep an SMS fallback.**

Key elapsed-time limits: 48h free CS window (unlimited since 2026-01-01) · 7d CS cutoff (`-230`) · 1yr for transaction messages · 45d user-offline (`-227`) · 7d uploaded-asset expiry · 2min Mini App phone token · 48h call link.

Frequency: 1 promo per user per day · 500 sends/day under 10k followers, else 5% of follower count · 4,000 req/min.

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
- Night-window guard branches on message type — CS replies and group messages are never deferred
- OA PKCE uses ONE fixed pair (challenge in console, verifier in env) — not a per-request pair
