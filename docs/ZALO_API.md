# Zalo Platform API — Integration Specification

> **Purpose of this document.** A self-contained implementation brief for an AI coding agent (Claude Code) building a Zalo Platform integration. It covers Official Account messaging, ZBS Template Message (both channels), group chat, Articles, Zalo Shop, voice calling, Social API login, Mini App auth and payments, and webhooks — with exact hosts, paths, headers, request/response shapes, error tables, and reference implementations in TypeScript, Python, and PHP.
>
> **Compiled:** 2026-08-20. Zalo's docs are Vietnamese-first and change without versioned changelogs. §23 lists every claim that is *unverified* — treat those as "confirm before shipping", not as spec.

**Companion files (use them):**

| File | What it is |
|---|---|
| `CLAUDE.md` | Auto-loaded rules file. Drop it at the repo root so the invariants in §2 apply on every turn without re-prompting. |
| `zalo-errors.json` | All ~180 error codes as machine-readable data, each tagged with a retry class. Generate error handling from this rather than transcribing §14. |
| `zalo-smoke-test.py` | Runnable end-to-end check: token flow, OA identity, quota, ZBS quality, and webhook signature verification against both candidate formulas. |

---

## 0. How to use this document

**If you are an AI agent implementing this:**

1. Read §1 first. There was a **breaking platform consolidation on 2026-01-01 and a service shutdown on 2026-03-01**. Building against the old transaction/promotion message APIs produces code that fails at runtime.
2. Internalise §2 — nine invariants that cause most Zalo integration failures. They are enforced as tests in §17.6, not just documented here.
3. Everything marked `⚠️ UNVERIFIED` must be behind a feature flag or covered by a test that runs against a real OA before it is trusted. §23 is the consolidated list.
4. Build in this order: token store (§4) → one working send (§5.3 or §5.4) → webhook receiver (§20) → everything else. Do not build the full endpoint surface before a single round-trip works.
5. Reference implementations in §18–§20 are complete and runnable. Prefer adapting them over writing from scratch — they encode the non-obvious details (raw-body capture, rotating refresh tokens, `access_token` as a bare header, NFC normalization).

**Choosing a send channel** — the decision that shapes everything else:

```
Does the user have a recent interaction with the OA?
├─ Yes, within 48h ──────────→ §5.3  CS message (free)
├─ Yes, 48h–7d ──────────────→ §5.3  CS message (billable)
└─ No, or never
   ├─ You hold their OA UID ─→ §5.4  ZBS template by UID   (price_uid — cheaper)
   ├─ You hold their phone ──→ §11    ZBS template by phone (price_sdt)
   ├─ They're in an OA group → §7    Group message (free)
   └─ You want everyone ─────→ §5.5  Broadcast (Article payload only)
```

**Documentation URL note.** `developers.zalo.me/docs/*` is a client-rendered SPA and returns nothing useful to `curl`/fetch. The same content is served server-rendered at:

- `https://docs.zaloplatforms.com/docs/OA/...` (Official Account)
- `https://docs.zaloplatforms.com/docs/Social/...` (Social API)
- `https://docs.zaloplatforms.com/docs/MA/...` (Mini App — **not** in the main sitemap)
- `https://stc-developers.zdn.vn/docs/v2/<section>/<page>/index.html` (static CDN mirror — **the `/index.html` suffix is required**)
- `https://stc-developers.zdn.vn/docs/sitemap.xml` — 318 URLs, the authoritative index of what exists

ZaloPay is a separate platform with separate docs at `docs.zalopay.vn` (§12.4).
---

## 1. Platform status as of August 2026 — read this before writing code

### 1.1 ZNS has been folded into "ZBS Template Message"

Every ZNS documentation page now carries this banner:

> *"Từ ngày 01/01/2026, dịch vụ ZNS được hợp nhất vào ZBS Template Message"*
> (From 2026-01-01, the ZNS service is consolidated into ZBS Template Message.)

**ZBS is an umbrella with two delivery channels.** This is the single most important structural fact in this document:

| Channel | Endpoint | Addressed by | Price field |
|---|---|---|---|
| **Phone** | `POST https://business.openapi.zalo.me/message/template` | `phone` | `price_sdt` |
| **UID** | `POST https://openapi.zalo.me/v3.0/oa/message/template` | `user_id` | `price_uid` |

Same templates, same approval workflow, **different hosts and different pricing**. The phone channel is the old ZNS wire protocol, unchanged. The UID channel is new and is the direct replacement for the discontinued OA transaction/promotion messages.

**`price_uid` is typically cheaper than `price_sdt`.** If you already hold a user's OA UID — because they follow you, messaged you, or came through a Mini App — sending by UID rather than phone is the cheaper path for identical content. Read both prices off the template detail (§7.8) and route accordingly.

### 1.2 UID transaction and personal-promotion messages are dead

From Zalo's notice on the transaction-message page:

> *"Dịch vụ Tin UID Giao dịch (165 vnd) và UID Truyền thông cá nhân sẽ được dừng cung cấp từ 01/03/2026."*
> (The UID Transaction message service (165 VND) and UID Personal Promotion service will be discontinued from 2026-03-01.)

That date has passed. **Do not implement:**

- `POST /v3.0/oa/message/transaction`
- `POST /v3.0/oa/message/promotion`

They are documented in §5.13 **for legacy-migration reading only**.

**Migration path — this is a mechanical mapping:**

| Old | New |
|---|---|
| `/v3.0/oa/message/transaction` (free-form elements) | ZBS template, `tag: 1` (Transaction), sent via `/v3.0/oa/message/template` |
| `/v3.0/oa/message/promotion` (per-user promo) | ZBS template, `tag: 3` (Promotion), sent via `/v3.0/oa/message/template` |

The cost of the migration is that content must now be **pre-registered and approved as a template** rather than composed at send time. Budget review turnaround into your schedule; you can no longer ship a new message shape with a code deploy.

### 1.3 There is no OA sandbox

Worth knowing before you plan a test strategy: `dev-openapi.zalo.me` circulates in community code as a sandbox host, but it appears **nowhere in Zalo's sitemap or any documentation page**. Treat it as nonexistent.

What actually exists for safe testing:

| Path | Scope |
|---|---|
| **ZBS/ZNS development mode** (`"mode": "development"`) | Template sends only, and **only to App or OA administrators** |
| **OA Extension sandbox** (`developers.zalo.me/app/<app_id>/extension/sandbox`) | Extensions only |
| **ZaloPay sandbox** (`https://sb-openapi.zalopay.vn`) | Payments only — a genuine, documented sandbox |

For OA messaging, GMF, Article and Shop there is **no simulator and no test tenant**. You develop against a real OA, and several features require a *verified* OA on a paid tier before they respond at all. Plan for this: get the OA verified and provisioned early, because it gates development, not just launch. See §17.6 for the fake-transport pattern that makes this tolerable.

### 1.4 What is alive, at a glance

| Capability | Status | Section |
|---|---|---|
| OA consultation messages (`/message/cs`) | ✅ Live | §5.3 |
| **ZBS template by UID** (`/v3.0/oa/message/template`) | ✅ Live — replaces the discontinued UID messages | §5.4 |
| ZBS template by phone (`business.openapi…/message/template`) | ✅ Live | §11 |
| Broadcast to followers | ✅ Live (Article payload only) | §5.5 |
| Group chat (GMF) send + management | ✅ Live (verified OA + Advanced/Premium) | §7 |
| Article API | ✅ Live (v2.0, async token model) | §13 |
| Zalo Shop (products/orders) | ✅ Live (`/v2.0/mstore/*`) | §14 |
| Voice & video calling | ✅ Live (consent-gated) | §15 |
| Anonymous-user messaging, reactions | ✅ Live | §5.15, §5.10 |
| Social API login + profile | ✅ Live (reduced surface) | §18 |
| Mini App auth + checkout | ✅ Live | §19 |
| OA transaction / promotion UID messages | ❌ **Shut down 2026-03-01** | §5.13 |
| Social friend list / invitable friends / share API | ❌ **Removed from the platform** | §11.5 |
| OA sandbox host | ❌ **Does not exist** | §1.3 |

### 1.5 Also note: `error -240`

If you inherit a codebase calling the v2 message API you will see:

```
-240  MessageV2 API has been shut down, please switch to MessageV3
```

Note that this applies to the **message** API specifically. Several other v2.0 paths (uploads, tags, broadcast, Article, Shop, anonymous messaging, reactions) are current and correct — do not "upgrade" them to v3.0 on the assumption that v2 is uniformly dead. Version is per-endpoint-family on this platform, not global.
---

## 2. Non-negotiable invariants

These ten items cause the overwhelming majority of Zalo integration failures. Encode them structurally, not as comments.

1. **Auth is a bare `access_token:` header — never `Authorization: Bearer`.**
   ```
   access_token: AbCdEf123...
   ```
   Some community wrappers use `ZALO_OA_ACCESS_TOKEN` as the header name. That is wrong.

2. **The app secret travels in a `secret_key:` HTTP header on token requests**, not as `client_secret` in the body and not via HTTP Basic. This is a deliberate deviation from OAuth 2.0.

3. **Refresh tokens are single-use and rotating.** Every successful refresh invalidates the old refresh token and returns a new one. If you lose the new one, the grant is gone and an OA admin must re-consent through a browser. Persist the new pair *transactionally, before* you use the new access token (§4.3).

4. **`error != 0` arrives with HTTP 200.** You cannot use HTTP status codes to detect application errors. Every client wrapper must check `body.error !== 0` explicitly, on every call, including ones you think cannot fail.

5. **Webhook signature verification uses plain `sha256()` of a concatenated string — NOT HMAC-SHA256.**
   ```
   mac = sha256(appId + rawBody + timestamp + oaSecretKey)
   ```
   Reaching for `crypto.createHmac` / `hmac.new` here will never validate. Note that `appsecret_proof` (§4.5) *is* real HMAC — the two look similar and are not.

6. **You must capture the raw request body bytes for webhook verification.** Parsing JSON and re-serializing reorders keys and normalizes whitespace, which changes the digest. Wire raw-body capture into your HTTP framework *before* the JSON body parser.

7. **Webhooks must return HTTP 200 within 2 seconds.** Enqueue and acknowledge; never process inline. Zalo retries at 30s, 5m, 15m, 30m, 1h — so handlers must be **idempotent**, keyed on `message.msg_id`.

8. **The night window is per message type — it is NOT a blanket ban.** Customer-service replies and group messages send 24/24. Promotional messages are blocked 22:00–05:59 (`-234`). Transaction messages send at any hour but their **push notification is suppressed** outside 06:00–21:59, so they arrive silently. Your scheduler must branch on message type, not block everything (§15.3).

9. **OA consent is console-configured, not request-built.** `redirect_uri` and `code_challenge` are saved in the console (Sản phẩm → Official Account → Thiết lập chung) and Zalo generates the consent link. Building your own authorize URL returns `-14003`, and a per-request PKCE pair fails the later token exchange. The Social flow is the opposite — per-request is correct there (§4.1).

10. **Normalize Vietnamese text to NFC before every length check.** The same visible string can be 43 or 55 characters depending on encoding form. Against Zalo's character limits this silently produces both false rejections and real `-1121` errors. One line, applied everywhere (§23).
---

## 3. Prerequisites, accounts, and concepts

### 3.1 The three accounts you need

| Entity | Where | Needed for |
|---|---|---|
| **Zalo App** | `developers.zalo.me` | Everything. Gives you `app_id` + `secret_key`. |
| **Official Account (OA)** | `oa.zalo.me` | OA messaging, ZNS. Must be **verified** for most paid features. |
| **Zalo Cloud Account (ZCA)** | `zalo.cloud` | Billing. **Required for ZNS** — without it you get `-136` / `-137` / `-1381`. |

The App and the OA must be **linked** in the developer console. Social API error `112 — Your app don't link with any Official Account` exists specifically for this.

### 3.2 Credential inventory

Store these as secrets. Never in source, never in client-side code.

```
ZALO_APP_ID          # numeric string, e.g. "3608465248940903967"
ZALO_APP_SECRET      # the "secret key" from the app dashboard — used as the
                     #   `secret_key` header AND as the webhook signing key
ZALO_OA_ID           # numeric string, returned on the OAuth callback
ZALO_REDIRECT_URI    # must byte-match the Callback URL registered in the console
```

The **same** `ZALO_APP_SECRET` value is used for three distinct purposes: the `secret_key` header on token exchange, the trailing term in the webhook signature, and the HMAC key for `appsecret_proof`. Do not create three config entries for it — one secret, three consumers.

### 3.3 The three user-ID namespaces — this trips everyone up

Zalo issues **different opaque IDs for the same human** depending on which entity is asking:

| ID | Scope | Where you obtain it |
|---|---|---|
| `id` from Social `/v2.0/me` | Per **Zalo App**. Stable within that app only. | Social API |
| `user_id` (a.k.a. UID) | Per **Official Account**. | OA webhooks, OA follower APIs |
| `user_id_by_app` | The App-scoped ID, surfaced on the OA side | OA webhooks and user APIs |

**Mapping a Social login to an OA follower:** join on `user_id_by_app`. The App and OA must be linked first.

> `⚠️ UNVERIFIED` — that `user_id_by_app` is *byte-equal* to the Social API `/v2.0/me` `id` is asserted by community SDKs but is **not stated on any current Zalo page**. Verify empirically with one real account before building account-linking on it. If it does not hold, use Mini App `getUserInfo()` (§12.1), which returns `id` and `idByOA` together and is the one place Zalo documents the mapping cleanly.

Design implication: your `users` table should carry **all three** ID columns as nullable, not one "zalo_id" column.

### 3.4 Response envelope (universal)

Every Zalo REST API returns:

```json
{ "data": { ... }, "error": 0, "message": "Success" }
```

`error: 0` means success. **Non-zero `error` arrives with HTTP 200** — you cannot rely on HTTP status codes for application errors. Every client wrapper must check `body.error !== 0` explicitly. This is the single most common source of silent failure in Zalo integrations.

---
---

## 4. Authentication

There are **two separate OAuth flows** with confusingly similar URLs. Getting them mixed up produces opaque failures.

| Flow | Authorize URL | Token URL | Grants access to |
|---|---|---|---|
| **OA** (admin consents on behalf of an OA) | `https://oauth.zaloapp.com/v4/oa/permission` | `https://oauth.zaloapp.com/v4/oa/access_token` | OA messaging, ZNS, follower data |
| **Social** (end user logs in) | `https://oauth.zaloapp.com/v4/permission` | `https://oauth.zaloapp.com/v4/access_token` | That user's name/avatar |

Note the `/oa/` path segment — that is the *only* difference in the URL.

### 4.1 OA authorization flow — console-configured, NOT a dynamic redirect

> **This is the single most misunderstood part of the platform, and the most common cause of a blocked integration.** The OA flow does **not** work like the Social flow or like standard OAuth 2.0. You do not build the authorize URL at request time. `redirect_uri` and `code_challenge` are **saved settings in the developer console**, and Zalo **generates** the permission link from them. Constructing your own URL with an invented `redirect_uri` returns **`-14003 Invalid redirect uri`** no matter how thoroughly you have verified the domain.

**Step 1 — generate ONE PKCE pair, not one per request.**

Because the challenge is stored in the console (Step 2), the verifier that matches it is a **long-lived configuration value**, not a per-request secret. Generate one pair, put the challenge in the console, and keep the verifier in your secret store.

```
code_verifier  = base64url_nopad(32 random bytes)   → 43 chars → ZALO_PKCE_VERIFIER
code_challenge = base64url_nopad(SHA256_raw(ASCII(verifier)))
```

⚠️ **A per-request PKCE pair is the wrong shape here.** Standard RFC 7636 practice — mint a verifier, stash it in a cookie, exchange it once — is correct for the Social flow (§11.2) and **fails on the OA flow**, because the console holds a fixed challenge that your per-request verifier will never match. The failure surfaces later, at `/v4/oa/access_token`, after `-14003` is already fixed — so it looks like a second, unrelated bug.

**Step 2 — register the callback URL and challenge in the console.**

```
developers.zalo.me → [your app] → Sản phẩm → Official Account → Thiết lập chung
    → Official Account Callback Url   [your callback URL]
    → Code Challenge                  [the challenge from Step 1]
    → tick the permission groups you need
    → Lưu
```

Zalo's own words (`bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new`, Bước 2):

> *"Truy cập Zalo for Developers để thiết lập đường dẫn yêu cầu cấp quyền. Tại bước này, bạn cần thiết lập callback URL và tham số code challenge vừa được tạo ở bước 1."*
> (Go to Zalo for Developers to set up the authorization request path. At this step you must set the callback URL and the code challenge parameter just created in step 1.)

> *"Callback URL là nơi bạn sẽ phải thực hiện xử lý để nhận được authorization code."*
> (The Callback URL is where you must implement handling to receive the authorization code.)

**This screen is documented only as screenshots with no alt text**, which is why it is invisible to search engines and to anyone reading the JS-rendered docs site. The page that used to explain it (`official-account-api/phu-luc/official-account-callback-url`) has been **deleted** — it is still cited in community threads but is absent from the current sitemap.

**Tick every permission group you will eventually need, now.** Changing the callback URL *or* the permission set **invalidates the existing grant** and forces the OA admin to re-consent. The nine groups offered are: gửi tin và thông báo qua OA · quản lý tin nhắn người dùng · quản lý thông tin OA · quản lý ads · quản lý bài viết · quản lý cửa hàng, đơn hàng · sử dụng chức năng gọi thoại · nhận sự kiện quản lý tin nhắn · nhận sự kiện quản lý người dùng. ZBS adds its own groups (§7) — if you plan to send templates, tick those too.

**Step 3 — send the generated link to the OA admin.**

> *"Sao chép đường dẫn yêu cầu cấp quyền và gửi đến admin của OA để bắt đầu quá trình nhận authorization code."*
> (Copy the authorization request link and send it to the OA admin to begin obtaining the authorization code.)

> *"Admin chọn tài khoản OA cần cấp quyền và chọn 'Cho phép' để xác nhận cấp quyền."*

The link Zalo emits has this shape, but **treat it as opaque and copy it verbatim** rather than reconstructing it:

```
https://oauth.zaloapp.com/v4/oa/permission?app_id=<APP_ID>&redirect_uri=<ENCODED>&code_challenge=<CHALLENGE>
```

This is a one-time human step per OA, not something your application performs. Your `/connect` route, if you have one, should *display* the stored link — not build one.

**Step 4 — Zalo redirects back:**

```
https://yourdomain.com/zalo/callback?code=<AUTHORIZATION_CODE>&oa_id=<OA_ID>
```

`oa_id` comes back on the callback — this is how you learn *which* OA was authorized. Persist it alongside the token pair. The authorization code is **valid for 10 minutes and single-use**.

**Step 5 — exchange:**

```http
POST https://oauth.zaloapp.com/v4/oa/access_token
Content-Type: application/x-www-form-urlencoded
secret_key: <APP_SECRET>

code=<AUTHORIZATION_CODE>&app_id=<APP_ID>&grant_type=authorization_code&code_verifier=<THE STORED VERIFIER>
```

```json
{ "access_token": "...", "refresh_token": "...", "expires_in": "90000" }
```

`expires_in` is a **string**, not a number. `90000` seconds = 25 hours.

**Step 6 — refresh (same URL, same header):**

```http
POST https://oauth.zaloapp.com/v4/oa/access_token
Content-Type: application/x-www-form-urlencoded
secret_key: <APP_SECRET>

refresh_token=<CURRENT_REFRESH_TOKEN>&app_id=<APP_ID>&grant_type=refresh_token
```

Returns a **new access token and a new refresh token**. The old refresh token is dead the instant this succeeds.

### 4.1.1 Prerequisite chain — each link has its own error code

Authorization fails opaquely if any of these is missing. Verify them in order before debugging anything else.

| # | Requirement | Console path | Error if missing |
|---|---|---|---|
| 1 | App **activated** | Quản lý ứng dụng → Cài đặt → toggle *"Chưa kích hoạt"* → *"Đang hoạt động"* | `-209 Not supported this api` — and `-14002` at the permission endpoint |
| 2 | **Official Account API** product registered | Quản lý ứng dụng → Đăng ký sử dụng API → Official Account API | `-212 App has not registed this api` |
| 3 | Domain or URL prefix **verified** | Quản lý ứng dụng → Xác thực domain | — |
| 4 | **Official Account Callback Url** saved | Sản phẩm → Official Account → Thiết lập chung | **`-14003 Invalid redirect uri`** |
| 5 | OA admin has **granted** the app | the consent link from Step 3 | `-223 Official Account has not authorized this API` |
| 6 | App ↔ OA **linked** | app settings | `112 Your app don't link with any Official Account` |

`-209` is badly named: *"Not supported this api"* does not mean the endpoint is unsupported, it means **your app is not activated**.

### 4.1.2 The `-14xxx` family — authorize-endpoint errors

`oauth.zaloapp.com` has its **own error family**, entirely separate from the runtime tables in §14. Do not look for these in the OA or Social error appendices; they are not there, and no `-14xxx` table is published anywhere.

| Code | `error_name` | Meaning |
|---|---|---|
| `-14002` | `Invalid appId` | `error_reason: "App is not active but user is not admin"` — the app is not activated, and the person clicking is not an app admin. Activate the app, or run the flow as an admin |
| `-14003` | `Invalid redirect uri` | The `redirect_uri` does not match the **Official Account Callback Url** saved in the console. `error_reason` comes back **empty** |

Two diagnostic notes. First, the JSON body carries an `error_name` string and a `ref_doc` link — **log the whole body**, because `error_name` is the only real signal Zalo gives. Second, `ref_doc` on `-14003` points at the **Social API** docs even for the OA endpoint, which suggests `oauth.zaloapp.com` validates redirect URIs in one shared layer across `/v4/permission` and `/v4/oa/permission`. Do not let that link send you to the wrong console screen.

`⚠️ UNVERIFIED` — whether the console compares the saved callback to `redirect_uri` by exact string or by prefix. Since the console *generates* the link, echo the saved value byte-for-byte and the question does not arise.

### 4.1.3 Shortcut: skip OAuth entirely while you build

**Tools & Support → API Explorer** → select your app → token type **"OA Access Token"** → select the OA → review permissions → **Allow** → copy the access token **and the refresh token**.

Seed your token store with that pair and the whole integration — sends, webhooks, quota — is testable immediately, with the consent flow still broken. Given that there is no sandbox (§1.3), this is the single most useful unblocking tool on the platform, and it is buried in a menu. Available to OA admins and app admins only.

### 4.2 Token lifetimes

| Token | Lifetime | Rotates? |
|---|---|---|
| OA authorization code | 10 min, single use | — |
| **OA access token** | **25 hours** (`expires_in: "90000"`) | — |
| **OA refresh token** | **3 months** | ✅ single-use, rotating |
| Social authorization code | 10 min, single use | — |
| **Social access token** | **1 hour** (`expires_in: "3600"`) | — |
| **Social refresh token** | **30 days maximum** | ✅ single-use, rotating |

**Critical subtlety on the Social refresh token:** it does **not** reset its clock when rotated. It inherits the *remaining* lifetime of its predecessor:

```
t=0h    code → AT1 (1h) + RT1 (720h remaining)
t=1h    RT1  → AT2 (1h) + RT2 (719h remaining)
t=2h    RT2  → AT3 (1h) + RT3 (718h remaining)
```

After 30 days the user **must** re-authorize interactively. There is no extension mechanism. Build the "your Zalo connection expired, please reconnect" UX path — you will need it every 30 days per user.

> `⚠️ CONTRADICTION IN ZALO'S DOCS` — the Android and iOS SDK pages both claim the Social refresh token lasts 3 months, contradicting the dedicated Social API page's 30 days. **Assume 30 days** (the dedicated page is newer and more specific); the SDK pages appear to be stale copy inherited from the OA docs.

### 4.3 Token store design (do this properly the first time)

The rotating single-use refresh token makes naive implementations lose grants. Requirements:

1. **Single-flight.** Concurrent requests must not both attempt a refresh. Use a distributed lock (Redis `SET NX`, Postgres advisory lock) keyed on the OA ID.
2. **Write-before-use.** Persist the new `{access_token, refresh_token, expires_at}` tuple in a single committed transaction *before* returning the access token to a caller. If the process dies between "Zalo rotated the token" and "we saved it", the grant is unrecoverable.
3. **Refresh proactively.** For OA, refresh at ~20 hours (of 25). For Social, refresh at ~50 minutes (of 60). Do not wait for a `-220` / `452`.
4. **Keep an audit trail.** Log every rotation with a timestamp. When a grant mysteriously dies, this log is the only way to find out why.
5. **Alert on refresh failure.** A failed OA refresh requires human intervention (an admin must re-consent in a browser). It should page someone, not retry silently.

Recommended schema:

```sql
CREATE TABLE zalo_tokens (
  scope           TEXT NOT NULL,          -- 'oa' | 'social'
  subject_id      TEXT NOT NULL,          -- oa_id, or the app-scoped user id
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  access_expires  TIMESTAMPTZ NOT NULL,
  refresh_expires TIMESTAMPTZ,            -- social only; ~30d from FIRST grant
  rotated_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, subject_id)
);
```

Note `refresh_expires` is computed from the **first** grant for Social, not from the last rotation (§4.2).

### 4.4 PKCE

> **Scope note.** What follows is the mechanics of computing a valid challenge. **When** you compute it differs by flow: the Social flow (§11.2) uses a fresh pair per login, while the OA flow uses **one fixed pair** registered in the console (§4.1). Getting this backwards is a documented failure mode.

Zalo's prose describes the challenge as:

```
code_challenge = Base64.encode(SHA-256.hash(ASCII(code_verifier)))
```

with the constraint that `code_verifier` is **exactly 43 characters** of mixed-case alphanumerics.

Zalo's own PHP SDK resolves the "Base64.encode" ambiguity — it is standard RFC 7636 **S256** with base64url, no padding:

```php
// zaloplatform/zalo-php-sdk — src/Util/PKCEUtil.php  (abridged)
public static function genCodeVerifier(): string {
    $random = bin2hex(openssl_random_pseudo_bytes(32));
    return self::base64url_encode(pack('H*', $random));           // 43 chars
}
public static function genCodeChallenge(string $codeVerifier): string {
    return self::base64url_encode(pack('H*', hash('sha256', $codeVerifier)));
    //                            ^^^^^^^^ hex digest → RAW bytes before base64url
}
```

So concretely:

1. `verifier = base64url_nopad(32 random bytes)` → exactly 43 chars ✓
2. `challenge = base64url_nopad(SHA256_raw_digest(ASCII(verifier)))` — the **raw 32 bytes**, not the 64-char hex string
3. base64url = standard base64 with `+`→`-`, `/`→`_`, `=` stripped

**Non-standard aspects to be aware of:**

- There is **no `code_challenge_method` parameter.** S256 is implicit. Sending it is undocumented.
- There is **no `scope` parameter** on the Social authorize URL.
- There is **no `response_type` parameter.**
- Verifier length is pinned at 43, not RFC 7636's 43–128 range.

> `⚠️ UNVERIFIED` — whether PKCE is **mandatory** for the OA flow. Zalo's docs mention `code_challenge` but the appendix that documents OAuth codes explicitly does not cover verifier/challenge generation, and at least one working community OAuth strategy (`Jollor/passport-zalo-oa`) sends no PKCE at all. Zalo does document that PKCE is enforced when you **disable App Secret Key verification** in App settings → Login. Implement PKCE regardless — it costs nothing and is required in the strict configuration.

### 4.5 `appsecret_proof`

**Mandatory since 2024-01-01** on `graph.zalo.me/v2.0/me`. Sent as a header alongside `access_token`:

```
appsecret_proof: <lowercase hex of HMAC-SHA256(access_token, key=app_secret)>
```

```js
crypto.createHmac("sha256", APP_SECRET).update(accessToken).digest("hex")
```

Note this **is** real HMAC — unlike the webhook signature (§13.3), which is not. Do not copy one implementation into the other.

Zalo's PHP SDK exposes it as `$zalo->setUseAppSecretProof(true)`.

Failure codes: OA `-242`, ZNS `-1241` ("Invalid appsecret_proof provided in the API argument").

> `⚠️ UNVERIFIED` — whether `appsecret_proof` is enforced on OA/ZNS endpoints generally or only on `graph.zalo.me`. The mandate is documented on the Mini App page; community reports of `-242` suggest broader enforcement. Implement it as an opt-in flag you can flip per-endpoint.

### 4.6 DPoP (optional, newer)

Zalo has added RFC 9449 DPoP for the Social flow. **Currently optional** — every documented table lists `Tính bắt buộc` (required) = **no**.

```
DPoP: <jwt>
```

JWT header: `{"typ":"dpop+jwt","alg":"RS256"|"ES256","jwk":{...public key...}}`
JWT payload: `{"htu":"https://oauth.zaloapp.com/v4/access_token","htm":"POST","iat":1751877103}`

Skip it for v1 of your integration; note it as a hardening item.

---
---

## 5. Official Account API


### 5.1 Hosts and conventions


| Host | Use |
|---|---|
| `https://openapi.zalo.me/v3.0/oa/...` | Current messaging + user APIs |
| `https://openapi.zalo.me/v2.0/oa/...` | Still current for uploads, tags, broadcast, anonymous messaging, reactions, Article, Shop |

**There is no sandbox host.** `dev-openapi.zalo.me` appears in community code but in no Zalo documentation — see §1.3. API version is per-endpoint-family, not global: do not assume a v2.0 path is stale.

**Every call:**
```
access_token: <OA_ACCESS_TOKEN>
Content-Type: application/json     (on POST)
```

**GET endpoints take their parameters as a single JSON-encoded `data` query param**, which is unusual and easy to get wrong:

```bash
curl --globoff -X GET \
  'https://openapi.zalo.me/v3.0/oa/user/detail?data={"user_id":"4572947693969771653"}' \
  -H 'access_token: <TOKEN>'
```

The `--globoff` flag is needed in curl because of the braces. In code, URL-encode the JSON string.

### 5.2 The message-window policy model


This is the part that determines whether your product concept is even possible on Zalo.

**Consultation messages (`tin tư vấn` / CS) are reactive only.** Zalo's stated conditions:

> *"User (người nhận tin): có tương tác với OA trong vòng 7 ngày"*
> (The recipient must have interacted with the OA within 7 days.)

**Two distinct windows, both real:**

| Window | Effect |
|---|---|
| **≤ 48 hours** since last interaction | Message is **free**. Historically capped at 8 free messages per window; **unlimited from 2026-01-01**. Read `cs_reply.remain` rather than assuming either model |
| **48 hours – 7 days** | Message is **billable** |
| **> 7 days** | Message is **rejected** with `-230` |

**What counts as an "interaction":**

- Following the OA (quan tâm)
- Sending a message to the OA
- Accepting a call from the OA
- Clicking the messaging button on the OA profile page
- Clicking the OA's icon or call button
- Clicking a quick-interaction or service-menu item carrying an `oa.query` value

**Implication for your architecture:** you cannot initiate outbound OA conversation with a cold user using a consultation message. Anything proactive (order updates, OTPs, reminders) must go through a ZBS template — either **by UID** (§5.4, same host, no phone number needed) or **by phone** (§11). Neither requires prior interaction.

Always **pre-flight with the quota endpoint** (§5.13) rather than discovering `-230` after spending an API call.

### 5.3 Send a consultation message


```
POST https://openapi.zalo.me/v3.0/oa/message/cs
Content-Type: application/json
access_token: <TOKEN>
```

**Plain text** — max **2,000 characters**:

```json
{
  "recipient": { "user_id": "2512523625412515" },
  "message":   { "text": "Xin chào! Đơn hàng của bạn đã được xác nhận." }
}
```

**Image / GIF** (`media` template):

```json
{
  "recipient": { "user_id": "2468458835296117922" },
  "message": {
    "text": "Zalo đạt 100 triệu người dùng",
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "media",
        "elements": [
          { "media_type": "image", "url": "https://example.com/bg_1.jpg" }
        ]
      }
    }
  }
}
```

- `media_type` ∈ `image` | `gif`
- Supply **either** `url` **or** `attachment_id` — never both
- `width` and `height` are **required when `media_type` is `gif`**
- Images: jpg/png, ≤ 1 MB

**File** — note the type is `file`, not `template`, and the payload key is `token`:

```json
{
  "recipient": { "user_id": "2468458835296117922" },
  "message": {
    "attachment": {
      "type": "file",
      "payload": { "token": "12i8LV3Bcmm...ZM" }
    }
  }
}
```

**Request user info** — prompts the user to share name/phone/address. **Maximum 1 element.**

```json
{
  "recipient": { "user_id": "2468458835296117922" },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "request_user_info",
        "elements": [{
          "title": "Cửa hàng ABC",
          "subtitle": "Đang yêu cầu thông tin từ bạn",
          "image_url": "https://example.com/logo.png"
        }]
      }
    }
  }
}
```

The user's response arrives asynchronously via the **`user_submit_info` webhook** (§13.5) — not in the API response.

**Other CS templates** documented but not detailed here: sticker, quote (`trích dẫn`). Shared `elements` / `buttons` schemas live at `docs.zaloplatforms.com/docs/OA/phu-luc/cau-truc-cua-tham-so-elements` and `.../cau-truc-cua-tham-so-buttons`.

> `⚠️ UNVERIFIED` — the `list` template. There is no v3.0 documentation page for it; the only evidence it exists is the `oa_send_list` webhook event name. Treat it as unavailable for sending on v3.0.

### 5.4 Send a template message by UID (ZBS) — the replacement for discontinued UID messages


This is the **proactive** OA send path. Unlike consultation messages it is not gated on a recent interaction window, and unlike the phone channel (§11) it does not require you to hold the user's phone number.

```
POST https://openapi.zalo.me/v3.0/oa/message/template
Content-Type: application/json
access_token: <TOKEN>
```

```json
{
  "user_id": "2512523625412515",
  "template_id": "7895417a7d3f9461cd2e",
  "template_data": {
    "customer": "Nguyễn Thị Hoàng Anh",
    "order_code": "PE010299485",
    "amount": "100000"
  }
}
```

```json
{
  "error": 0,
  "message": "Success",
  "data": {
    "message_id": "a4d0243feee163bd3af2",
    "user_id": "2512523625412515",
    "sent_time": "1626926349402",
    "quota": { "quota_type": "purchase_quota", "remain": 4821 }
  }
}
```

**Differences from the phone channel that will bite you:**

| | UID channel | Phone channel (§11) |
|---|---|---|
| Host | `openapi.zalo.me` | `business.openapi.zalo.me` |
| Recipient field | `user_id` | `phone` |
| `tracking_id` | **not accepted** | **required** |
| Response id field | `data.message_id` | `data.msg_id` |
| Price | `price_uid` | `price_sdt` |
| Delivery webhook | ordinary OA message webhooks | `user_received_message` (ZNS) |

The absent `tracking_id` is the sharpest edge. On the phone channel `tracking_id` is how you correlate a send to your domain object and to the delivery receipt. **On the UID channel you have no such field** — you must persist the mapping yourself, keyed on the returned `data.message_id`, at the moment of the send. Write that row before you consider the send complete.

`quota_type` values: `purchase_quota` (paid) and `reward_quota` (earned/granted). Track them separately — reward quota is consumed first and its exhaustion changes your unit cost without any error being raised.

**Tag rules on the UID channel:**

- Tag 1 `TRANSACTION` and Tag 2 `CUSTOMER_CARE` — transactional; the ordinary path
- Tag 3 `PROMOTION` — additionally bounded by the recipient's **platform-level promotional receipt cap**, which is shared across every OA that messages them. A send can fail for promotional saturation caused entirely by other businesses. Treat Tag 3 failures as expected background noise, not as defects.

### 5.5 Broadcast to followers


```
POST https://openapi.zalo.me/v2.0/oa/message
```

Note this is **v2.0** and shares its path with anonymous messaging (§5.15) and reactions (§5.10) — the endpoint is polymorphic on the body shape, which is unusual and worth a comment in your client.

```json
{
  "recipient": {
    "target": {
      "ages": [3, 4],
      "gender": [1],
      "locations": [2],
      "cities": [0],
      "platform": [1, 2]
    }
  },
  "message": {
    "attachment": {
      "payload": {
        "template_type": "media",
        "elements": [{ "media_type": "article", "attachment_id": "<ARTICLE_ID>" }]
      }
    }
  }
}
```

**The constraint that shapes your architecture: broadcast can only send an Article.** There is no free-text broadcast. `attachment_id` must come from the Article API (§13), so any broadcast feature is really an Article-authoring feature with a send button. Build §13 first.

Targeting enums:

| Field | Values |
|---|---|
| `ages` | 0–7 (age buckets) |
| `gender` | 0 unspecified, 1, 2 |
| `locations` | 0 North, 1 Central, 2 South |
| `cities` | 0–63 (province codes) |
| `platform` | 1 iOS, 2 Android, 3 Windows |

Omitting a field means "no filter on this dimension". Response: `{"data":{"message_id":"..."},"error":0,"message":"Success"}`.

Quota: `POST /v2.0/oa/quota/message` with `{"user_id": "...", "type": "promotion"}` → `{type, remain, total}`, monthly and set by OA package.

### 5.6 Messaging anonymous users


Users who reach the OA without a Zalo identity (for example via certain web entry points) appear as an **anonymous_id + conversation_id pair**. There is no `user_id`.

```
POST https://openapi.zalo.me/v2.0/oa/message
```

```json
{
  "recipient": { "anonymous_id": "...", "conversation_id": "..." },
  "message":   { "text": "Xin chào" }
}
```

**Both ids are required.** The response echoes `message_id`, `anonymous_id`, and `conversation_id`. Text is capped at 2,000 characters, same as CS messages. Image, file, and sticker variants follow the same attachment shapes as §5.3.

Inbound arrives via the anonymous-user webhooks (§13.5). Anonymous conversations are ephemeral in a way follower conversations are not — do not build long-lived state on an `anonymous_id`.

### 5.7 Message reactions


```
POST https://openapi.zalo.me/v2.0/oa/message
```

```json
{
  "recipient":     { "user_id": "..." },
  "sender_action": { "react_icon": "/-strong", "react_message_id": "96d3cdf3af150460909" }
}
```

Note the key is `sender_action`, **not** `message`. Icons: `:>--b` · `-:((` · `/-strong` · `/-heart` · `-h:o`, and `/-remove` to revoke a reaction. Maximum **50 reactions per `message_id`**.

Cheap and underused: reacting to an inbound message is a zero-cost acknowledgement that does not consume send quota and does not open a billing window. For a bot that needs to signal "received, working on it" without spending a CS message, this is the right primitive.
### 5.8 Uploads


| Method | Path | Limit | Returns |
|---|---|---|---|
| POST | `/v2.0/oa/upload/image` | jpg/png, ≤ 1 MB | `attachment_id` |
| POST | `/v2.0/oa/upload/file` | PDF/DOC/DOCX/CSV, ≤ 5 MB | `token` |
| POST | `/v2.0/oa/upload/gif` | — | `attachment_id` |

`multipart/form-data`, field name `file`, header `access_token`.

```bash
curl -H 'access_token: <TOKEN>' -F "file=@/tmp/test.jpg" \
  https://openapi.zalo.me/v2.0/oa/upload/image
```

```json
{"data":{"attachment_id":"wESbL53O_shdvIPILC7iR_JpC552r_fjukKg"},"error":0,"message":"Success"}
```

**Two operational constraints:**

- Quota is **5,000 upload requests per month**.
- **Uploaded assets expire after 7 days** on Zalo's servers. Do not cache `attachment_id` / `token` values in your database as though they were permanent. Expired IDs return `-100`. Re-upload on demand, or refresh assets on a 6-day cycle.

> `⚠️ MINOR DISCREPANCY` — Zalo's docs say `v2.0` for all three upload paths; the community library `ChickenAI/zalo-node-oa` hardcodes `v3.0`. Both may route identically. Use the documented **v2.0**.

### 5.9 Follower / user data


**`GET /v3.0/oa/user/detail`** — `data={"user_id":"..."}`

Response fields: `user_id`, `user_id_by_app`, `user_external_id`, `display_name`, `user_alias`, `is_sensitive`, `user_last_interaction_date`, `user_is_follower`, `avatar`, `avatars{120,240}`, `dynamic_param`, `tags_and_notes_info{notes[], tag_names[]}`, `shared_info{address, city, district, phone, name}`.

⚠️ `user_last_interaction_date` is a **`"DD/MM/YYYY"` string**, not an epoch. For window calculations use `last_interaction` from the quota endpoint (§5.13), which *is* epoch ms.

**`GET /v3.0/oa/user/getlist`** — `data` supports:

| Param | Constraint |
|---|---|
| `offset` | max **9951** |
| `count` | max **50** |
| `tag_name` | filter by tag |
| `last_interaction_period` | `TODAY` \| `YESTERDAY` \| `L7D` \| `L30D` \| `YYYY_MM_DD:YYYY_MM_DD` |
| `is_follower` | boolean |

```json
{"data":{"total":6,"count":15,"offset":0,
  "users":[{"user_id":"4572947693969771653"}]},"error":0,"message":"Success"}
```

The `offset` cap of 9951 means **you cannot paginate through more than ~10k followers**. For larger OAs, segment by `tag_name` or `last_interaction_period` and paginate within each segment.

Related: `POST /v3.0/oa/updatefollowerinfo`, plus documented endpoints for updating user detail, deleting user info, and CRUD on custom user-info fields.

### 5.10 Tags


| Method | Path |
|---|---|
| POST | `/v2.0/oa/tag/tagfollower` |
| POST | `/v2.0/oa/tag/rmfollowerfromtag` |
| POST | `/v2.0/oa/tag/rmtag` |
| GET | `/v2.0/oa/tag/gettagsofoa` |

```bash
curl -X POST -H "Content-Type: application/json" -H 'access_token: <TOKEN>' \
  -d '{"user_id": 2468458835296197922, "tag_name": "Khách hàng Quận 1"}' \
  "https://openapi.zalo.me/v2.0/oa/tag/tagfollower"
```

Note `user_id` here is an **unquoted long**, unlike most other endpoints where it is a string. `tag_name` auto-creates the tag if it does not exist.

`gettagsofoa` returns a **flat array of strings**, not objects:

```json
{"data":["Khách Q1","Khách Q2"],"error":0,"message":"Success"}
```

### 5.11 Custom user fields


Separate from tags and from `updatefollowerinfo`: a dynamic schema you define once, then populate per follower.

| Action | Path family |
|---|---|
| Create / list / update / delete field **definitions** | `/v3.0/oa/user/field/*` — see `quan-ly-truong-thong-tin-nguoi-dung/*` |
| Get / update field **values** on a follower | same family |

`⚠️ UNVERIFIED` — exact verb paths. The doc pages exist (`lay-danh-sach-truong-thong-tin`, and create/update/delete siblings); I have not opened each to extract literal paths. Fetch the index before implementing.

Use these rather than encoding structured data into tag names. Tags are a flat string namespace with no typing; custom fields are the intended place for `customer_tier`, `last_order_id`, and similar.

### 5.12 Conversations


**`GET /v2.0/oa/conversation`** — `data={"user_id":...,"offset":0,"count":5}`, **max 10 messages per request**
**`GET /v2.0/oa/listrecentchat`** — `data={"offset":0,"count":5}`, **max 10 per request**

Both return a **bare array** in `data` (unlike `user/getlist`, which nests under `data.users`):

```json
{"src":1,"time":1619401853770,"type":"text","message":"Chào shop",
 "message_id":"92e5d851aa8178dd2192","from_id":"3700646744485476903",
 "to_id":"3120036654733951760","from_display_name":"Khoa Pham",
 "from_avatar":"https://...","to_display_name":"OA","to_avatar":"..."}
```

`src: 1` = from the user. `time` is epoch **milliseconds**.

### 5.13 OA info and quota APIs


**`GET /v2.0/oa/getoa`** → `oaid`, `name`, `description`, `oa_alias`, `is_verified`, `oa_type`, `cate_name`, `num_follower`, `avatar`, `cover`, `package_name`, `package_valid_through_date`, `package_auto_renew_date`, `linked_ZCA`.

This is your health-check endpoint — cheap, no side effects, and it surfaces `is_verified`, `package_name`, and `linked_ZCA`, which are exactly the three things that silently gate half the platform. Call it at boot and assert on them rather than discovering `-221` / `-224` / `-136` at send time.

**There are three different quota endpoints.** They are easy to confuse:

| Endpoint | Body | Answers |
|---|---|---|
| `POST /v3.0/oa/quota/message` | `{"user_id": "..."}` | Per-user CS reply + promotion quota, and `last_interaction` |
| `POST /v3.0/oa/quota/message` | `{"quota_owner":"OA"\|"APP", "product_type":"cs"\|"transaction", "quota_type":"..."}` | OA-wide asset quotas: array of `{asset_id, product_type, quota_type, valid_through, total, remain}` |
| `POST /v2.0/oa/quota/message` | `{"user_id":"...", "type":"promotion"}` | Promotion/broadcast quota |

The v3.0 endpoint is overloaded on body shape — same path, two different questions. Wrap each in its own named method so callers cannot mix them up.

Per-user response:

```json
{"data":{
   "last_interaction":"1690184100000",
   "cs_reply":   {"remain":8,"total":8},
   "promotion":  {"daily_remain":0,"daily_total":1,
                  "monthly_remain":4,"monthly_total":6}},
 "error":0,"message":"Success"}
```

**`last_interaction` is the value you use to compute the 48h/7d windows client-side** before spending a send:

```
age = now - last_interaction
age <= 48h        → free send, check cs_reply.remain > 0
48h < age <= 7d   → billable send
age > 7d          → do not attempt; will return -230, use a UID template (§5.4) instead
```

Also documented, worth knowing they exist: a free-CS-quota check and a dedicated 48-hour-window check (`kiem-tra-han-muc-tin-tu-van-mien-phi`, `kiem-tra-tin-tu-van-trong-khung-48h`).

### 5.14 Buying OA packages and quota programmatically


You can purchase OA tiers and GMF quota via API rather than the web console:

```
POST https://openapi.zalo.me/v3.0/oa/purchase/create_order
```

```json
{ "beneficiary": "OA", "product_id": 1234567890, "voucher_code": "OPTIONAL" }
```

→ `order_id`, `product_name`, `zca_id`, `amount`, `final_amount`, `verified_token`. A companion endpoint confirms payment. `beneficiary` is `"OA"` or `"APP"`; `redeem_code` may be supplied in place of `product_id`.

A catalogue page lists concrete `product_id` values for Standard / Growth / Advanced / Premium / Comprehensive at 6- and 12-month terms, and for GMF 10 / 50 / 100 / 1000 seat packages.

Relevant mainly if you are building a multi-tenant product that provisions OAs for customers. For a single-OA integration, buy through the console.
### 5.15 Legacy: transaction and promotion messages ⚠️ DISCONTINUED 2026-03-01


**Do not implement. Included only so you can recognize and migrate existing code.**

`POST /v3.0/oa/message/transaction` accepted 13 `template_type` values: `transaction_billing`, `transaction_order`, `transaction_reward`, `transaction_contract`, `transaction_booking`, `transaction_membership`, `transaction_event`, `transaction_transaction`, `transaction_account`, `transaction_internal`, `transaction_partnership`, `transaction_education`, `transaction_rating`. Payload carried `language: "VI" | "EN"` plus `elements[]` and `buttons[]`.

`POST /v3.0/oa/message/promotion` used `template_type: "promotion"` with element types `banner`, `header` (content ≤ 100 chars), `text` (≤ 1000 chars), `table` (rows of `{key ≤ 25, value ≤ 100}`), and buttons (`title` ≤ 35 chars, `type` ∈ `oa.open.url` | `oa.query.hide`).

**Migration path:** rebuild these as ZBS templates and send them via `POST /v3.0/oa/message/template` (§5.4) — same host, same `user_id` addressing, so the call site barely moves. The mapping is: transaction message → template with `tag: 1` (Transaction); promotion message → template with `tag: 3` (Promotion), which additionally requires the 20,000/day quota tier and is subject to the recipient's platform-wide promotional cap.
---

## 6. Group chat (GMF)

OA-owned group chats. Messages inside a group are **free** — they do not consume send quota and are not bound by the 7-day interaction window. For any use case involving a cohort that talks back (cohort-based courses, VIP customer groups, delivery-team coordination), this is dramatically cheaper than 1:1 messaging and is frequently the right answer.

**Gating, check before you design around it:**

- OA must be **verified**
- OA must be on the **Advanced or Premium** package
- A GMF quota package must be purchased (`gmf10` / `gmf50` / `gmf100` / `gmf1000` — the number is the member ceiling)
- Invitees must already be followers, or have interacted within 7 days

All endpoints are on `https://openapi.zalo.me/v3.0/oa/group/*` and take the usual `access_token` header.

### 6.1 Sending into a group

**One endpoint for every message type**, discriminated by body shape:

```
POST https://openapi.zalo.me/v3.0/oa/group/message
```

```json
{
  "recipient": { "group_id": "..." },
  "message":   { "text": "Chào cả nhóm!" }
}
```

Image, file, and sticker variants use the same `message.attachment` shapes as consultation messages (§5.3) — the payload grammar is shared, only the recipient key differs (`group_id` instead of `user_id`).

**Mentions use inline syntax inside `message.text`:**

| Syntax | Effect |
|---|---|
| `[@user_id]` | mention one member |
| `[@group_id]` | mention everyone |

This is a string convention, not a structured field, which means **user-supplied text containing `[@...]` will be interpreted as a mention**. Escape or strip that pattern from anything you relay from users into a group, or you have a trivial @everyone injection.

Response: `{"data":{"message_id":"...","group_id":"..."},"error":0}`.

### 6.2 Group management

| Action | Method | Path |
|---|---|---|
| Create group | POST | `/v3.0/oa/group/creategroupwithoa` |
| List OA's groups | GET | `/v3.0/oa/group/getgroupsofoa` (`offset`, `count`, default 5) |
| Update info / settings | POST | `/v3.0/oa/group/updateinfo` |
| List members | GET | `/v3.0/oa/group/listmember` (`group_id`, `offset`, `count`) |
| Invite members | POST | `/v3.0/oa/group/invite` (`group_id`, `member_user_ids[]`) |
| Group conversation history | GET | `/v3.0/oa/group/conversation` (`group_id`, `offset`, `count`) |
| GMF quota | POST | `/v3.0/oa/quota/group` |
| Group info · delete group · accept member · reject member · pending members · add admins · remove admins · remove members · recent chats · update asset | — | `⚠️ UNVERIFIED` paths — doc pages exist under `official-account/nhom-chat-gmf/quan-ly/*` and follow the same `/v3.0/oa/group/<verb>` shape (`get_group_info`, `delete_group`, `accept_member`, `reject_member`, `getlistpendingmember`, `add_admins`, `remove_admins`, `remove_members`, `list_recent_chat`, `update_asset`). Confirm each before use. |

**Create:**

```json
{
  "group_name": "Lớp Tiếng Anh A1",
  "group_description": "Nhóm hỗ trợ học viên",
  "asset_id": "<PURCHASED_GMF_PACKAGE>",
  "member_user_ids": ["...", "..."]
}
```

Maximum **99 members in the initial list** — larger groups must be filled by subsequent `invite` calls. Response returns `group_id`, `group_link` (`https://zalo.me/g/xxxx`), and `status`. Persist `group_link`: it is the shareable join URL and there is no documented way to re-derive it.

**Update settings** accepts `lock_send_msg`, `join_appr` (approval required to join), `enable_msg_history` (new members see history), `enable_link_join`. The response splits into `group_info` / `asset_info` / `group_setting` and includes `max_member` and **`auto_delete_date`** — groups have an expiry tied to the asset. Surface `auto_delete_date` in your own UI; a group silently vanishing is a bad way for a customer to learn about quota expiry.

**Quota:** `product_type` ∈ `gmf10` | `gmf50` | `gmf100` | `gmf1000`; `quota_type` ∈ `sub_quota` | `purchase_quota` | `reward_quota`.

### 6.3 Group webhooks

Fully enumerated in §13.5. In short: every `user_send_*` and `oa_send_*` event has a `*_group_*` twin, plus ten lifecycle events (`create_group`, `user_join_group`, `user_request_join_group`, `react_request_join_group_accept`, `react_request_join_group_reject`, `add_group_admin`, `remove_group_admin`, `update_group_info`, `user_leave_group`, `delete_group`).

Note `-237 The group is disabled` — this is what you get when the GMF asset has expired, and it is a *billing* condition presented as a *message* error.
---

## 7. ZBS Template Message — phone channel (formerly ZNS)

Proactive, **phone-number-addressed**, template-based notifications.

> **Read §5.4 first.** This is one of ZBS's two channels. If you already hold the recipient's OA UID, the UID channel (`POST /v3.0/oa/message/template`) sends the *same template* at the `price_uid` rate, which is typically cheaper than the `price_sdt` rate charged here. Use this section when you have a phone number and no UID — a new customer, an imported list, a checkout that collected a phone.

### 7.1 Host and auth

**Base host:** `https://business.openapi.zalo.me` — note this is a *different host* from OA messaging.

```
access_token: <OA_ACCESS_TOKEN>     ← same token as OA API (§4.1)
Content-Type: application/json
```

ZNS uses the **same OA OAuth v4 token**. There is no separate ZNS credential. What ZNS *additionally* requires is that the OA be **verified**, on a paid plan, and linked to a **Zalo Cloud Account** for billing.

### 7.2 Endpoint inventory

| Purpose | Method | Path |
|---|---|---|
| **Send** | POST | `/message/template` |
| Send (dev mode) | POST | `/message/template` + body `mode:"development"` |
| Send by hashed phone | POST | `/message/template/hashphone` |
| Send RSA-encrypted | POST | `/rsa/message/template` |
| Generate RSA key | GET | `/rsa/key/gen` |
| Get RSA key | GET | `/rsa/key/get` |
| Journey: init token | POST | `/journey/get-token` |
| Journey: verify token | GET | `/journey/check-token` |
| Message status | GET | `/message/status?message_id=` |
| Quota | GET | `/message/quota` |
| Allowed content types | GET | `/message/template-tag` |
| OA sending quality | GET | `/quality` |
| Template list | GET | `/template/all?offset=&limit=&status=&filterPreset=` |
| Template detail | GET | `/template/info/v2?template_id=` |
| Template sample data | GET | `/template/sample-data?template_id=` |
| Create template | POST | `/template/create` |
| Edit template | POST | `/template/edit` |
| Upload image | POST | `/upload/image` (multipart) |
| Customer ratings | POST | `/rating/get` |
| **Quick-reply responses** | POST | `/response/get` |

There is **no cost-estimate endpoint**. Pricing surfaces as `price`, `price_sdt`, `price_uid` fields on template objects; insufficient balance appears as `-115` / `-137`.

### 7.3 Send

```http
POST https://business.openapi.zalo.me/message/template
Content-Type: application/json
access_token: <TOKEN>
```

| Field | Type | Req | Notes |
|---|---|---|---|
| `phone` | string | ✅ | `84987654321` or `+84987654321` |
| `template_id` | string | ✅ | Zalo-issued |
| `template_data` | object | ✅ | keys = registered param names |
| `tracking_id` | string | ✅ | your correlation ID, **max 48 chars**, avoid special chars |
| `sending_mode` | string | — | `"1"` standard (default), `"3"` send beyond quota (whitelisted OAs only) |
| `mode` | string | — | `"development"` for dev-mode sends |

```bash
curl --location 'https://business.openapi.zalo.me/message/template' \
  --header 'Content-Type: application/json' \
  --header 'access_token: <TOKEN>' \
  --data '{
    "phone": "84987654321",
    "template_id": "7895417a7d3f9461cd2e",
    "template_data": {
      "customer": "Nguyễn Thị Hoàng Anh",
      "cid": "PE010299485",
      "amount": "100000"
    },
    "tracking_id": "order-88213"
  }'
```

```json
{
  "error": 0,
  "message": "Success",
  "data": {
    "msg_id": "a4d0243feee163bd3af2",
    "sent_time": "1626926349402",
    "sending_mode": "1",
    "quota": { "dailyQuota": "500", "remainingQuota": "499" }
  }
}
```

`sent_time` is epoch **milliseconds as a string**. Every response carries live quota — log `remainingQuota` and alert on it rather than polling `/message/quota` separately.

**Use `tracking_id` as your idempotency key.** Set it to a deterministic value derived from your domain object (`order-88213-shipped`), so a replayed send is traceable. It is also echoed back on the delivery webhook (§13.6), which is the only way to correlate a delivery receipt to your record.

> `⚠️ LIKELY NONEXISTENT` — `campaign_id`. Some third-party gateway docs mention it. There is no first-party evidence it exists in Zalo's direct API. If you see it in sample code, that code is targeting an aggregator (Infobip / 8x8 / eSMS), not Zalo directly.

### 7.4 Phone number normalization

Zalo documents **`84987654321`** or **`+84987654321`** — country code, no leading zero. The domestic `0987654321` form is **not documented as accepted** and should be normalized client-side. Error `-108` is "Phone number is invalid".

```python
import re
def normalize_vn_phone(raw: str) -> str:
    d = re.sub(r"\D", "", raw)
    if d.startswith("0"):  d = "84" + d[1:]
    if not d.startswith("84"): d = "84" + d
    return d
```

Normalize **before** hashing for `hash_phone` sends.

### 7.5 Development mode

Add `"mode": "development"` to the send body. Restriction, per Zalo:

> *Development mode only supports sending trial ZNS templates to application administrators or OA administrators.*

- Dev-wallet exhaustion → `-126`
- Sending a test template to a non-admin → `-127`

This is your integration-test path. Wire it to an env flag so CI never sends real messages.

### 7.6 Hash-phone and RSA sends (PII minimization)

**Hash phone** — `POST /message/template/hashphone`, replace `phone` with `hash_phone` = **SHA-256 hex of the normalized `84…` number**:

```json
{ "hash_phone": "544bcae26adc08abc55ec3db75887109eacf8bfe65a2150bc8db2802403d57f2", ... }
```

Response is identical to a standard send. Note that the delivery webhook's `recipient.id` will then be the **hash**, not the number.

**RSA** — cipher is `RSA/ECB/OAEPWITHSHA-256ANDMGF1PADDING`. Public key is returned base64-encoded; decode to bytes before use.

1. `GET /rsa/key/gen` — create the keypair (returns `-143` if one already exists)
2. `GET /rsa/key/get` — retrieve the public key (returns `-142` if none exists → call gen)
3. `POST /rsa/message/template` with `rsa_phone` (encrypted + base64), `template_id`, `template_data` (encrypted values, base64), `tracking_id`

Decode failure → `-123`.

Use these if your compliance posture forbids sending plaintext phone numbers to third parties. Otherwise the standard send is simpler.

### 7.7 Status, quota, quality

**`GET /message/status?message_id=<id>`**

```json
{"message":"Success","data":{"delivery_time":"1600328011517",
 "message":"The message was delivered to the user's phone","status":1},"error":0}
```

| `status` | Meaning |
|---|---|
| `-1` | Message does not exist |
| `0` | Pushed to server, not yet delivered |
| `1` | Delivered to the user's phone |

**`GET /message/quota`**

```json
{"data":{"dailyQuota":500,"remainingQuota":499,
 "dailyQuotaPromotion":null,"remainingQuotaPromotion":null,
 "monthlyPromotionQuota":125,"remainingMonthlyPromotionQuota":124,
 "estimatedNextMonthPromotionQuota":2000},"error":0,"message":"success"}
```

**`GET /quality`**

```json
{"data":{"oaCurrentQuality":"HIGH","oa7dayQuality":"HIGH"},"error":0,"message":"success"}
```

Values: `HIGH` | `MEDIUM` | `LOW` | `UNDEFINED` (nothing sent in the window). `oaCurrentQuality` is a 48-hour window; `oa7dayQuality` is 7 days. **Poll this daily and alert on any drop** — see §7.11 for why.

**`GET /message/template-tag`** → `{"data":["OTP","IN_TRANSACTION","POST_TRANSACTION"],"error":0,"message":"success"}` — the content types this OA is currently permitted to send.

### 7.8 Template management

**`GET /template/info/v2?template_id=12345`**

```json
{"error":0,"message":"Success","data":{
  "templateId":"12345","templateName":"...","status":"ENABLE",
  "listParams":[{"name":"payment_link","require":true,"type":"STRING",
                 "maxLength":30,"minLength":0,"acceptNull":false}],
  "listButtons":[{"type":1,"title":"Truy cập website","content":"https://..."},
                 {"type":2,"title":"Gọi CSKH","content":"0858808xxx"}],
  "timeout":7200000,
  "previewUrl":"https://account.zalo.cloud/znspreview/...",
  "templateQuality":"HIGH","templateTag":"IN_TRANSACTION",
  "price_sdt":"800","price_uid":"560","price":"800"}}
```

Fetch this at startup (or on a cache with a few hours' TTL) and **validate `template_data` against `listParams` before sending**. Every param length violation you catch locally is one you do not pay for as a `-1121`.

Button `type` values: 1 website/invoice lookup · 2 phone call · 3 OA info page · 4 Zalo Mini App · 5 app download · 6 product distribution · 7 external website/Mini App · 8 external app · 9 OA article · 10 copy · 11 instant payment · 12 view details.

**`GET /template/all?offset=0&limit=100&status=1&filterPreset=1`**

- `limit` max 100
- `status`: 1 = Enable, 2 = Pending review, 3 = Reject, 4 = Disable (omit for all)
- `filterPreset`: 0 = all OA templates, 1 = only templates created by the calling app

Returns `data[]` of `{templateId, templateName, createdTime, status, templateQuality}` plus `metadata.total`.

**`POST /template/create`**

| Field | Type | Req | Constraint |
|---|---|---|---|
| `template_name` | string | ✅ | 10–60 chars |
| `template_type` | int | ✅ | 1–5 |
| `tag` | string | ✅ | 1–3 |
| `layout` | array | ✅ | header / body / footer components |
| `params` | array | — | `{name, type, sample_value}` |
| `note` | string | — | 1–400 chars |
| `tracking_id` | string | ✅ | your correlation ID |

`template_type`: **1** Custom · **2** Authentication/OTP · **3** Payment request · **4** Voucher · **5** Service rating
`tag`: **1** Transaction · **2** Customer care · **3** Promotion

Response includes `status: "PENDING_REVIEW"`, `price_sdt`, `price_uid`, `preview_url`.

**`POST /template/edit`** — same fields plus `template_id`. **Only works on templates in `REJECT` status** (`-1091` otherwise). Templates created through the Admin web tool cannot be edited via API.

Rate limit: template create and edit are each **100 requests/day**.

### 7.9 Template parameters and content limits

**Parameter type enum — used at create/edit time (integers):**

| Code | Meaning | Max chars |
|---|---|---|
| 1 | Customer name | 30 |
| 2 | Phone number | 15 |
| 3 | Address | 200 |
| 4 | Code / ID | 30 |
| 5 | Custom label | 30 |
| 6 | Transaction status | 30 |
| 7 | Contact info | 50 |
| 8 | Gender / title | 5 |
| 9 | Product / brand name | 200 |
| 10 | Quantity / amount | 20 |
| 11 | Time / date | 20 |
| 12 | OTP | 10 |
| 13 | URL | 200 |
| 14 | Currency (VNĐ) | 12 |
| 15 | Bank transfer note | 90 |

⚠️ Note the representation mismatch: **create/edit uses these integers**, but `template/info/v2 → listParams[].type` returns **string names** (`"STRING"` observed). The full string enum is `⚠️ UNVERIFIED`.

**Data formatting rules:**

- Amounts render Vietnamese-style: `1000` → `1.000`; decimals use a comma (`0,3`)
- Currency must be a **positive integer**
- Allowed date/time formats: `hh:mm:ss`, `hh:mm`, `hh:mm:ss dd/mm/yyyy`, `hh:mm dd/mm/yyyy`, `dd/mm/yyyy`, `mm/yyyy`
- Bank transfer note forbids: ``@[]^_!"•#$%¥&'()*+,€-./:;{|<}=~>?``
- CTA URL params must be UTF-8 encoded and must not reuse names used in the title/body

**Layout component limits:**

| Component | Constraint |
|---|---|
| `TITLE` | 9–65 chars, max 4 params |
| `PARAGRAPH` | 9–400 chars, max 10 params |
| `OTP` | 1–10 chars |
| `TABLE` | 2–8 rows; `title` 3–36 (fixed text only), `value` 3–90; `row_type` 0 none, 1 success, 2 update, 3 notice, 4 error, 5 basic |
| `ATTACHMENT` | `type:"IMAGE"`, `media_id` from upload API |
| `LOGO` | `light` + `dark` attachment objects |
| `IMAGE` | 1–3 attachments |
| `BUTTON` | 1–2 items; `title` 5–30 chars fixed text; `content` = URL/phone |
| `PAYMENT` | `bank_code` (BIN), `account_name` 1–100, `bank_account` 1–100, `amount` fixed 2,000–500,000,000 or currency param, `note` 1–90 |
| `VOUCHER` | `name` 1–30, `condition` 1–40, `voucher_code` 1–25, `start_date` optional, `end_date` required |
| `RATING` | exactly 5 star objects; `title` 1–50, `question` 1–100, ≤5 `answers` (1–50 each), `thanks` 1–100, `description` 1–200 |

**Image upload** (`POST /upload/image`): JPG/PNG, **max 500 KB**, **5,000 images/month per app**. Logo: PNG 400×96. Images: 16:9. Returns `{"data":{"media_id":"..."},"error":0,"message":"Success"}`.

**Approval workflow:** create/edit → `PENDING_REVIEW` → Zalo review → `ENABLE` or `REJECT`. The outcome arrives **asynchronously via the `change_template_status` webhook** with a human-readable `reason`. Statuses: `ENABLE`, `PENDING_REVIEW`, `DISABLE`, `REJECT`, `DELETE`. A rejected template cannot be sent (`-131`) but can be edited and resubmitted.

### 7.10 Quick-reply templates

A ZBS-only template class with no ZNS equivalent: the recipient taps a reply option inside the message and you collect the answers.

```
POST https://business.openapi.zalo.me/response/get
```

Body: `template_id`, `from_time`, `to_time` (epoch ms), `limit`.

```json
{"data":{"data":[{"data":"...","submitDate":"...","msgId":"...","oaId":"...","trackingId":"order-88213"}]}}
```

`trackingId` is the value you set on the original send, which is how you attribute a response to a specific message. There is also a webhook (`su-kien-nguoi-dung-phan-hoi-template-phan-hoi-nhanh`) — prefer it over polling.

This is the cheapest structured-feedback mechanism on the platform: no CS message consumed, no interaction window opened, and the response arrives keyed to your own id.

### 7.11 Quality and the daily-quota ladder — the thing that will surprise you

ZNS quota is **not a fixed plan allowance**. It is a dynamic tier that moves based on how recipients react to your messages.

**Daily quota ladder:**

```
500 (penalty floor) → 2,000 → 5,000 (new OA default) → 10,000
  → 20,000 (unlocks Tag 3 / promotion) → 50,000 → 100,000 → 500,000
```

**Movement rules:**

| Trigger | Effect |
|---|---|
| 7-day quality = Good **AND** volume sent ≥ 2× current daily quota | ⬆️ up one tier |
| 7-day quality = Poor | ⬇️ down one tier |
| Reports in a day exceed **2% of current daily quota** | ⬇️ immediate one-tier drop; evaluated hourly, max one drop per 24h |
| Individual template quality goes Low | that template is **auto-disabled** → sends fail `-146` |

Quality is measured as the **negative-feedback/report rate** of recipients.

**Engineering consequences:**

1. Your throughput ceiling can halve overnight without any code change. Handle `-144` (daily limit) as a *retryable-tomorrow* condition, not a bug.
2. Monitor `GET /quality` daily and alert on `MEDIUM`/`LOW`. By the time you notice via failed sends, you have already been demoted.
3. Monitor per-template `templateQuality` — one bad template can be disabled while the OA stays healthy.
4. To *climb* the ladder you must sustain ≥ 2× your current quota in volume. Growth is gated on volume, so plan ramp-up deliberately.

**Promotion (Tag 3) additional limits:**

- Monthly promotion allowance = **1/6 of non-promotional messages sent two months prior**
- Per-user cap: **4 promotional messages/month**
- The user must have had a transaction or care-level contact within the last **6 months**
- Exceeding → `-1441` (monthly) / `-1472` (per-user daily)

> `⚠️ VERIFY WHICH LADDER APPLIES` — the ZBS successor documentation describes a *different* ladder: `1,000 → 10,000 → 20,000 (default) → 50,000 → unlimited`, with the same 2% penalty and 7-day rules. Post-merger it is unclear which applies to a given OA. Read your actual `dailyQuota` from `/message/quota` rather than hardcoding tier assumptions.

**Hard limits, summarized:**

| Limit | Value |
|---|---|
| Night send ban | 22:00–06:00 GMT+7 → `-133` |
| Template create | 100 req/day |
| Template edit | 100 req/day |
| Image upload | 5,000/month/app |
| Per-template daily quota | when `applyTemplateQuota` is true → `-147` |
| Per-second TPS | `⚠️ UNVERIFIED` — not documented |

---
---

## 8. Article API

Articles are OA-hosted content pages. They matter beyond publishing because **broadcast (§5.5) can only send an Article** — if you want to reach your whole follower base, you go through here.

Host is `https://openapi.zalo.me` and the version is **v2.0**, not v3.0.

### 8.1 The async token model — read this first

`create` and `update` do **not** return the finished article. They return a `data.token` representing an in-flight job, and you poll a separate endpoint for the outcome.

```
POST /v2.0/article/create   →   { "data": { "token": "..." }, "error": 0 }
                            ↓
                       poll result endpoint until terminal
```

Two consequences worth designing for:

1. A `create` that returns `error: 0` **has not published anything yet**. Do not mark your domain object as published on that response. The job can still fail.
2. Broadcasting immediately after creating will fail, because the `attachment_id` does not exist yet. Broadcast must be a second step gated on the poll reaching a terminal success state.

Model an article as a small state machine (`draft → submitted → processing → live | failed`) rather than a synchronous call.

### 8.2 Create

```
POST https://openapi.zalo.me/v2.0/article/create
```

**Normal article** (`type: "normal"`):

| Field | Limit |
|---|---|
| `title` | 150 chars |
| `author` | 50 chars |
| `description` | 300 chars |
| `cover` | image |
| `body[]` | array of blocks: text / image / video / product |
| `related_medias[]` | related content |
| `tracking_link` | analytics URL |
| `status` | `show` \| `hide` — **defaults to `hide`** |
| `comment` | `show` \| `hide` — defaults to `show` |

**`status` defaults to `hide`.** An article created without it exists but is invisible, which reads as "the API silently did nothing". Set it explicitly.

**Video article** (`type: "video"`): `title`, `description`, `video_id`, `avatar`.

`POST /v2.0/article/update` mirrors create. Also documented: get list, get detail, delete, and a parallel **video-content** family (`noi-dung-dang-video/*` — list, detail, edit).

### 8.3 Video upload

Two steps, because conversion is asynchronous:

```
POST https://openapi.zalo.me/v2.0/article/upload_video/preparevideo   (multipart, field `file`)
  → { "data": { "token": "..." } }

GET  https://openapi.zalo.me/v2.0/article/upload_video/verify?token=...
  → { "status": <int>, "video_id": "...", "convert_percent": <int> }
```

| `status` | Meaning |
|---|---|
| 0 | Unknown |
| 1 | Ready — `video_id` is usable |
| 2 | Locked |
| 3 | Converting — check `convert_percent` |
| 4 | Failed |
| 5 | Deleted |

Poll `verify` with backoff until 1, 2, 4, or 5. Only status 1 yields a usable `video_id`.

### 8.4 Limits

| Limit | Value |
|---|---|
| Article images | ≤ 1 MB |
| Video | ≤ 50 MB, AVI or MP4 |
| Rate limit | 4,000 requests/minute (shared Article API bucket) |
| Transport | **TLS 1.2+ required** |

`-214 Article is being processed` and `-223 Your OA has reach the limit quota create article` are the two article-specific errors you will actually hit.

## 9. Zalo Shop (products and orders)

If the OA runs a Zalo-native storefront, this is the catalogue and order API. Paths are **`/v2.0/mstore/*`** on `https://openapi.zalo.me` — note `mstore`, not `store`, and v2.0 not v3.0. Permission group is "Quản lý bài viết", which also covers store and order management.

### 9.1 Products

| Action | Method | Path | Params |
|---|---|---|---|
| List OA's products | GET | `/v2.0/mstore/product/getproductofoa` | `offset`, `limit` ≤ 50 |
| Get one | GET | `/v2.0/mstore/product/getproduct` | `id` |
| Search | GET | `/v2.0/mstore/product/search` | `offset`, `limit`, `code` |
| Create | POST | `/v2.0/mstore/product/create` | body below |
| Update | POST | `/v2.0/mstore/product/update` | |
| Remove | POST | `/v2.0/mstore/product/remove` | |

Product body: `code`, `name`, `description`, `price` (**long, integer VND — no decimals**), `type_id_level1` / `type_id_level2` / `type_id_level3`, `collection_id`, `photos[]`, `sales[{start_time, end_time, sale_percent}]`, `status`.

Supporting endpoints exist for collections (`danh-muc`), product types (`loai-san-pham`), and product image upload (`tai-anh-san-pham`).

### 9.2 Orders

| Action | Method | Path | Params |
|---|---|---|---|
| List orders | GET | `/v2.0/mstore/order/getorderofoa` | `status`, `offset`, `limit` |
| Get one | GET | `/v2.0/mstore/order/getorder` | `id` |
| Update status | POST | `/v2.0/mstore/order/updatestatus` | `ids[]`, `status` |

Order status enum:

| Value | Meaning |
|---|---|
| 1 | New |
| 2 | Confirmed |
| 3 | Cancelled by seller |
| 4 | Cancelled by buyer |
| 5 | Shipping |
| 6 | Completed |

`updatestatus` takes an **array** of ids — batch your transitions rather than looping.

There are **order webhook events** (`phu-luc/su-kien-don-hang`) and a Shop-specific error table separate from the OA table in §14. If you are integrating Shop, read that table too; the codes do not overlap cleanly.

**The natural composition:** order webhook fires → you send a ZBS template by UID (§5.4) with the order status. That is the canonical Vietnamese commerce loop and it is why §5.4 matters more than any other single endpoint in this document.

## 10. Voice and video calling

Consent-gated calling from the OA to a user. Entirely separate from messaging quota.

### 10.1 Request consent

```
POST https://openapi.zalo.me/v2.0/oa/call/requestconsent
```

```json
{ "phone": "84987654321", "call_type": "audio", "reason_code": 103 }
```

`call_type` ∈ `audio` | `video` | `audio_and_video`.

| `reason_code` | Reason |
|---|---|
| 101 | Product consultation |
| 103 | Order confirmation |
| 105 | Delivery |
| 106 | Flight |
| 107 | Order update |

A companion endpoint checks whether the user has already granted consent, and it has **its own error-code table** distinct from the OA table.

### 10.2 Place the call

```
POST https://openapi.zalo.me/v3.0/oa/call/outbound
```

```json
{ "user_id": "...", "call_type": "audio", "agent_id": "optional" }
```

```json
{ "data": { "call_link": "https://zalo.me/app/link/...", "qr_code": "...", "ttl": 172800 } }
```

Note the API does not place a call — **it mints a link with a 48-hour TTL** (`ttl: 172800` seconds). Delivery of that link to the user, and the actual dialling, are separate concerns. Treat `call_link` as a short-lived credential: do not log it, do not cache it past its TTL.

Also documented: inbound link creation, agent/branch lookup (`lay-thong-tin-agent-branch`), and a Zalo Cloud Contact Center (ZCC) connection guide for teams routing calls through a contact-centre stack.

### 10.3 Call webhooks

Three events: consent requested / expired · user answered the consent prompt · call ended. Wire the consent-response event before building any calling UX — consent is asynchronous and the user may answer hours later.
---

## 11. Social API (Zalo Login)

### 11.1 Scope of what still exists

**The current Social API is login + basic profile. That is all.** Plan accordingly.

The entire "Tài liệu" section of the Social API docs now contains exactly two pages: an overview and "name + avatar". If your product design assumes a Zalo friend graph, invitable-friends, or a share API, **that design will not work** — see §11.5.

### 11.2 OAuth flow

Identical in shape to §4.1 but **without the `/oa/` path segment**:

```
https://oauth.zaloapp.com/v4/permission
  ?app_id=<APP_ID>
  &redirect_uri=<CALLBACK>
  &code_challenge=<CHALLENGE>
  &state=<NONCE>
```

```http
POST https://oauth.zaloapp.com/v4/access_token
Content-Type: application/x-www-form-urlencoded
secret_key: <APP_SECRET>

code=<CODE>&app_id=<APP_ID>&grant_type=authorization_code&code_verifier=<VERIFIER>
```

```json
{ "access_token": "...", "refresh_token": "...", "expires_in": "3600" }
```

Mobile variants swap `redirect_uri` for `pkg_name` + `sign_key` (Android) or `bndl_id` (iOS).

The **Callback URL must be registered** in App Management → Đăng nhập (Login) → Add Platform → Web. No wildcard/prefix-matching rules are documented — assume exact match.

Lifetimes and the 30-day inherited-TTL behavior: see §4.2. This is the part most likely to bite you.

### 11.3 Get the user profile

```bash
curl -X GET \
  -H 'access_token: <USER_ACCESS_TOKEN>' \
  -H 'appsecret_proof: <HMAC-SHA256(access_token, key=app_secret) hex>' \
  "https://graph.zalo.me/v2.0/me?fields=id,name,picture"
```

```json
{
  "error": 0,
  "message": "Success",
  "id": "UserId",
  "name": "User Name",
  "picture": { "data": { "url": "https://..." } }
}
```

Note the response is **flat** — `id` and `name` are at the top level, not under `data`. This differs from every other Zalo endpoint.

Documented rate limit: **unlimited**. Documented error: `210 — User not visible`.

**Supported `fields` values:**

| Field | Status |
|---|---|
| `id`, `name`, `picture` | ✅ Documented and supported |
| `birthday` | ✅ Appears in the Mini App verification response sample; the field exists |
| `gender` | `⚠️ UNVERIFIED` — legacy v2/v3-era field, **not present in any current Zalo doc**. Third-party SDK READMEs still list it. Do not assume availability; test it. |
| `is_sensitive` | boolean — flags accounts requiring special data-handling compliance |

**Auth placement:** the reference page documents `access_token` **only as a header**. The overview page shows a different query form in prose (`?accesstoken=...`, lowercase, no underscore). These are inconsistent. **Use the header.**

**Host aliases:** Zalo's own PHP SDK uses `graph.zaloapp.com`; all docs use `graph.zalo.me`. Both appear live. Prefer `graph.zalo.me`.

### 11.4 Pagination and transport

List APIs use `offset` / `limit`; responses carry `data` (array), `paging` (next/previous links), `summary` (total). **TLS 1.2 or higher is required** — *"Hệ thống Social API chỉ hoạt động trên giao thức TLS 1.2 trở lên"*.

### 11.5 Removed capabilities — do not design around these

There is **no** friend-list, invitable-friends, or graph share endpoint in the current Social API.

Evidence: the Social docs sidebar contains no such pages; the Android SDK's former "get Zalo friend list" page is gone from the current SDK sidebar; and a Zalo community thread titled *"Quyền của Zalo Social"* asks why Zalo Social has only the user-information permission.

The error table **still contains dead v2-era codes** for these (`289 read_requests`, `12001 Limit of friends list is too large. Maximum: 50`, `12009 Sender and Recipient is not friend`, `12011`, `12012`). Their presence in the table is not evidence the endpoints exist.

**Sharing is now Open-Graph-only, not an API.** You control the share card by putting meta tags on your page:

```html
<meta property="og:url"         content="https://your-site.com/page" />
<meta property="og:title"       content="Title" />
<meta property="og:description" content="Description" />
<meta property="og:image"       content="https://your-site.com/card.jpg" />
```

**There is no official Zalo Login JS SDK.** The Social SDK section contains only Android and iOS. Web login is a plain server-side redirect flow (§11.2). `https://sp.zalo.me/plugins/sdk.js` is the **Social Plugin** SDK — share and follow *widgets* only, no login:

```html
<script src="https://sp.zalo.me/plugins/sdk.js"></script>

<div class="zalo-share-button"
     data-href="https://your-site.com/"
     data-oaid="<OA_ID>" data-layout="1" data-color="blue" data-customize="false"></div>

<div class="zalo-follow-only-button" data-oaid="<OA_ID>" data-callback="onFollow"></div>
```

Call `ZaloSocialSDK.reload()` after dynamically changing widget config.

**Mobile SDK entry points:**

```java
// Android — SDK v2.5.0, min Android 4.3
ZaloSDK.Instance.authenticateZaloWithAuthenType(activity, LoginVia.APP_OR_WEB, codeChallenge, listener);
// LoginVia: APP | WEB | APP_OR_WEB
ZaloSDK.Instance.getAccessTokenByOAuthCode(ctx, oauthCode, codeVerifier, callback);
ZaloSDK.Instance.getProfile(ctx, accessToken, callback, fields);
// Must forward onActivityResult:
ZaloSDK.Instance.onActivityResult(this, reqCode, resCode, data);
```

```swift
// iOS — SDK v2.4.3
ZaloSDK.sharedInstance().authenticateZalo(
    with: ZAZAloSDKAuthenTypeViaZaloAppAndWebView,
    parentController: self,
    codeChallenge: CODE_CHALLENGE,
    extInfo: EXT_INFO) { response in
      // response?.oauthCode
}
```

Official server-side SDK (PHP): `composer require zaloplatform/zalo-php-sdk` (v4.0.4).

### 11.6 Mini App authentication

Moved to §12 — Mini App auth, backend verification, the checkout SDK, and ZaloPay are documented together there, because in practice they are one integration.


---

## 12. Mini App and payments

### 12.1 Mini App authentication

Client side, via `zmp-sdk`:

```ts
import { authorize, getAccessToken, getUserID, getUserInfo, getPhoneNumber } from "zmp-sdk";

const data = await authorize({ scopes: ["scope.userLocation", "scope.userPhonenumber"] });
```

**Scopes:** `scope.userInfo` (name, avatar) · `scope.userLocation` · `scope.userPhonenumber`

`getAccessToken()` — since SDK 2.35.0, apps receive the token **by default without user consent**, but it then only resolves the **user ID**. Name and avatar require `authorize({scopes:["scope.userInfo"]})` first.

`getPhoneNumber()` returns `{ token }` — **expires after 2 minutes, single use**. Exchange it server-side immediately; do not queue it.

`getUserInfo()` is the one place Zalo cleanly documents the ID mapping (§3.3):

| Field | Meaning |
|---|---|
| `id` | Unique user identifier **per Zalo App** |
| `idByOA` | OA-specific identifier (if app verified **or** user follows the linked OA) |
| `followedOA` | boolean |
| `name`, `avatar`, `isSensitive` | |

**If you need to map Social identities to OA UIDs and cannot verify the `user_id_by_app` equivalence (§3.3), routing users through a Mini App once is the reliable way to obtain both ids together.**

### 12.2 Backend verification

**Identity:**

```http
GET https://graph.zalo.me/v2.0/me
access_token:    <token from getAccessToken()>
appsecret_proof: <HMAC-SHA256(access_token, key=app_secret) hex>
```

Returns `id`, `name`, `birthday`, `picture`, `is_sensitive`. The `id` is unique per user per Zalo App and is your account-linking key.

**Phone number:**

```http
GET https://graph.zalo.me/v2.0/me/info
access_token: <getAccessToken() result>
code:         <token from getPhoneNumber()>
secret_key:   <app secret>
```

```json
{ "data": { "number": "849123456789" }, "error": 0, "message": "Success" }
```

⚠️ Note the inconsistency: `/me` uses the `appsecret_proof` header (an HMAC), while `/me/info` uses `secret_key` (the raw secret). Both are Zalo-documented. Do not "fix" one to match the other.

`⚠️ UNVERIFIED` — one research pass could not re-confirm the `/v2.0/me/info` host/path from a server-rendered source. It is documented on the Mini App `getPhoneNumber` page and is widely used. Verify against the live console before shipping a checkout flow that depends on it.

Zalo's review guidance: request the phone number only *when users begin using the feature that needs it* (checkout, event registration). Apps with unclear permission flows are rejected at review.

### 12.3 Mini App checkout SDK

Client-side payment, documented under `docs.zaloplatforms.com/docs/MA/checkoutSdk/*`:

| Function | Purpose |
|---|---|
| `createOrder(order)` | Start a payment |
| `checkTransaction({data})` | Poll result |
| `selectPaymentMethod` | Let the user choose a method |
| `purchase` | Execute |
| `getOrderStatus` / `updateOrderStatus` | Order lifecycle |
| `createRefund` / `getRefundStatus` | Refunds |

Events: `PaymentDone`, `OpenApp`, `PaymentClose`, `OnDataCallback`.

`checkTransaction` result codes: **1** success · **0** pending · **−1** failed · **−2** user cancelled.

`⚠️ UNVERIFIED` — the SDK docs publish no merchant **server** host backing `getOrderStatus` / `createRefund`. Do not treat a client-side success callback as authoritative: a client can lie, and `PaymentDone` is a UI event. Reconcile server-side before fulfilling, via ZaloPay's `/v2/query` (§12.4) or your own PSP record.

Also present in the Mini App docs and absent from this spec: **eKYC APIs** and **journey messaging** (`tin nhắn hành trình`). Both are commerce-relevant; endpoints are `⚠️ UNVERIFIED` here.

### 12.4 ZaloPay is a separate platform

Not part of the Zalo OA/Social platform. Different hosts, different credentials, different docs.

| | |
|---|---|
| Production | `https://openapi.zalopay.vn` |
| **Sandbox** | `https://sb-openapi.zalopay.vn` — a real, documented sandbox |
| Create order | `POST /v2/create` |
| Query status | `POST /v2/query` |
| Refund | `POST /v2/refund` |
| Callback | merchant-defined URL |
| Auth | HMAC-SHA256 — **`key1` signs requests, `key2` verifies callbacks** |
| Docs | `https://docs.zalopay.vn/` · `https://developers.zalopay.vn/v2/general/overview.html` |

Two things to carry over from this document: the callback **must** be verified with `key2` (not `key1`, and not skipped), and `/v2/query` is the authority on payment state — never the client callback.

The ZaloPay sandbox is the only real sandbox anywhere in this ecosystem (§1.3). If you are building commerce, do the payment integration first, in sandbox, while you wait for OA verification to clear.
---

## 13. Webhooks

### 13.1 Configuration

- Set the webhook URL in the **app** dashboard (click "Thay đổi" to enable the field). It is per-app, not per-request.
- The OA must have granted `Official_Account_Access_Token` to the app or no events fire.
- Zalo's requirement, verbatim: *"Webhook Url không nên dùng host:port, thay vào đó hãy dùng domain và phải được cấu hình https"* — use an **HTTPS domain**, not `host:port`.
- Optional filter: receive only text messages beginning with `#`.
- ZNS events carry an additional header `X-ZEvent-Server: ZNS`, so one endpoint can serve both.

### 13.2 The delivery contract

**Return HTTP 200 within 2 seconds, per event.**

Retry ladder on non-200: **30 seconds → 5 minutes → 15 minutes → 30 minutes → 1 hour.** Each retry carries a `num_retry` header.

> `⚠️ UNVERIFIED` — a third-party mirror claims up to 10 retries with increasing backoff for ZNS specifically. Zalo's own page documents the 5-step ladder above. Assume at-least-once delivery either way.

**Therefore:** validate signature → enqueue → return 200. Process asynchronously. Make every handler **idempotent, keyed on `message.msg_id`** (or `template_id` + `timestamp` for management events).

### 13.3 Signature verification

Header: **`X-ZEvent-Signature`**

```
X-ZEvent-Signature: mac=sha256(appId + data + timeStamp + OAsecretKey)
```

**This is a plain SHA-256 digest of a concatenated string, NOT HMAC-SHA256.** The secret is the final term of the plaintext, not a key.

Implementation checklist:

- The header **value literally starts with `mac=`** — strip that prefix before comparing.
- `data` = the **raw JSON request body, byte-for-byte as received**. Capture raw bytes before any parse. Re-serializing changes key order and whitespace and will never match.
- `timeStamp` = the `timestamp` field **from inside the body**, as a string.
- `appId` = your numeric Application ID, as a string.
- `OAsecretKey` = the app secret key — the same value used in the `secret_key` header (§3.2).
- Compare in **constant time**.

```python
import hashlib, hmac

def verify_zalo_signature(raw_body: bytes, header: str, app_id: str,
                          oa_secret: str, timestamp: str) -> bool:
    mac = header.split("=", 1)[1].strip() if "=" in header else header.strip()
    expected = hashlib.sha256(
        (app_id + raw_body.decode("utf-8") + timestamp + oa_secret).encode("utf-8")
    ).hexdigest()
    return hmac.compare_digest(expected, mac)
```

> `⚠️ IMPORTANT AMBIGUITY — handle both.` Multiple Zalo community threads show **working production code that uses `oa_id` as the first term instead of `app_id`**:
>
> ```js
> const raw = oa_id + JSON.stringify(req.body) + req.body.timestamp + OAsecretKey;
> ```
>
> The volume of community confusion on this exact point suggests the documented formula is either ambiguous or varies by event class. **Recommended implementation:** compute both the `app_id`-prefixed and `oa_id`-prefixed digests, accept if **either** matches, and log which one hit. Once you have live traffic telling you the answer, narrow to the one that fires.

### 13.4 Payload envelope

```json
{
  "app_id": "360846524940903967",
  "sender":    { "id": "246845883529197922" },
  "recipient": { "id": "388613280878808645" },
  "user_id_by_app": "552177279717587730",
  "event_name": "user_send_text",
  "message": { "text": "message", "msg_id": "96d3cdf3af150460909" },
  "timestamp": "154390853474"
}
```

**All IDs and `timestamp` are strings.** Do not parse them as numbers — they exceed 2^53 and will lose precision in JavaScript.

- For **user → OA** events: `sender.id` = user, `recipient.id` = OA
- For **OA → user** events: these **swap**, and `sender` gains an `admin_id`
- **Management** events use a flat `oa_id` field instead of sender/recipient
- **Media** events add `attachments[]` of `{type, payload}` where `type` ∈ `image` | `video` | `audio` | `file` | `sticker` | `gif` | `location` | `link`

### 13.5 Event catalogue

**User → OA (1:1):**
`user_send_text` · `user_send_image` · `user_send_link` · `user_send_audio` · `user_send_video` · `user_send_sticker` · `user_send_location` · `user_send_business_card` · `user_send_file`

**OA → user:**
`oa_send_text` · `oa_send_image` · `oa_send_gif` · `oa_send_list` · `oa_send_file` · `oa_send_sticker`

**Management:**
`follow` · `unfollow` · `user_submit_info` · `add_user_to_tag`
(also documented: remove-tag, create-tag, delete-tag, interaction-permission consent, `user_external_id` sync failure, data-subject-rights requests, user-info updates — `⚠️ exact literals unverified`)

**Group chat (GMF):**
`oa_send_group_{text,image,link,audio,location,video,business_card,sticker,gif,file}`
`user_send_group_{text,image,link,audio,video,business_card,sticker,gif,file}` (no `location` variant)
Lifecycle: `create_group` · `user_join_group` · `user_request_join_group` · `react_request_join_group_accept` · `react_request_join_group_reject` · `add_group_admin` · `remove_group_admin` · `update_group_info` · `user_leave_group` · `delete_group`

**Anonymous users (§5.15):** `su-kien-nguoi-dung-an-danh-gui-tin-nhan` (inbound) and `su-kien-official-account-gui-tin-nhan-cho-nguoi-dung-an-danh` (outbound echo). Payloads carry `anonymous_id` + `conversation_id` instead of `user_id`.

**Voice / video calls (§15):** three events — consent requested/expired · user answered the consent prompt · call ended. Consent is answered asynchronously, possibly hours later; wire this before building any calling UX.

**Zalo Shop (§14):** order events under `phu-luc/su-kien-don-hang`. The canonical commerce loop is *order event → ZBS template by UID* (§5.4).

**ZBS quick-reply (§7.10):** `su-kien-nguoi-dung-phan-hoi-template-phan-hoi-nhanh`.

**Interaction-permission widget:** `su-kien-nguoi-dung-dong-y-cap-quyen-tuong-tac` and `su-kien-dong-bo-user_external_id-that-bai`. There is **no API to trigger a follow invitation** — growth runs through Zalo's website widget, and consent arrives here.

**Compliance:** `su-kien-nguoi-dung-zalo-thuc-hien-quyen-chu-the-du-lieu` (data-subject rights request). Pair it with the delete-follower-data endpoint; §22.3 explains why this is not optional.

**Extension purchases:** `su-kien-mua-extension`.

**Other:** message-read / message-delivered, reaction events (user and OA).

**Notable payloads:**

`follow` / `unfollow` — note `follower` replaces `sender`, and a `source` field appears:

```json
{ "oa_id": "388613280879808645", "follower": { "id": "24684588352919792" },
  "user_id_by_app": "552172779717587730", "event_name": "follow",
  "source": "oa_profile", "app_id": "36084652489903967", "timestamp": "154397978274" }
```

`user_submit_info` — the async reply to a `request_user_info` template (§5.3):

```json
{ "sender": {"id":"246845883529697922"}, "recipient": {"id":"388613280879880645"},
  "event_name": "user_submit_info", "app_id": "3608465248940903967",
  "timestamp": "1540368141908",
  "info": { "name": "Name Example", "phone": "84912345678",
            "user_dob": "30/10/1999", "gender": "Nam",
            "full_address": { "user_city": "Thành phố Hồ Chí Minh",
                              "user_ward": "Phường Tân Thuận",
                              "user_address": "Đường số 13, KCX Tân Thuận Đông" } } }
```

`add_user_to_tag` — batch-shaped, no sender/recipient:

```json
{ "app_id": "360846524840903967", "oa_id": "388613280879880645",
  "user_id_by_app": "112380535248657707", "event_name": "add_user_to_tag",
  "tag": { "user_ids": ["246845883296197922"], "name": "example" },
  "timestamp": "15503500848" }
```

### 13.6 ZNS webhook events

**Delivery receipt** — `event_name: "user_received_message"`:

```json
{
  "sender":    { "id": "2893352839501541173" },
  "recipient": { "id": "84123456789" },
  "event_name": "user_received_message",
  "message": {
    "delivery_time": "1602960467432",
    "msg_id": "15a0cc0bbb13bd4ce403",
    "tracking_id": "order-88213"
  },
  "app_id": "2074138120372622546",
  "timestamp": "1602560967477"
}
```

- `sender.id` = OA ID; `recipient.id` = the recipient's **phone number** (or its SHA-256 hash if you sent via hash-phone)
- **Actual receipt time is `message.delivery_time`, not `timestamp`**
- `message.tracking_id` is the value you supplied on send — this is your correlation key

**Template status change** — `event_name: "change_template_status"`, with `oa_id`, `app_id`, `template_id`, `status: {prev_status, new_status}`, `reason`, `timestamp`. The `reason` is human-readable Vietnamese, e.g. *"Mẫu tin bị lặp; Mẫu tin có dấu hiệu spam; Logo không hợp lệ"*. **Surface this to whoever authors your templates** — it is the only feedback channel on rejections.

**Quota change** — `event_name: "change_oa_daily_quota"`, with `oaId`, `quota: {prev_value, new_value}`, `timestamp`. **Alert on this** — it is your early warning that the quality ladder (§7.11) moved.

Also documented: user responded to a service-rating template · ZNS sending-quality change for a template · allowed content-type change · journey billing started · journey expired.

---
---

## 14. Error codes

### 14.1 Handling strategy

Classify every error into one of four buckets and let that drive behavior. Do not write per-code branches scattered through business logic.

| Class | Codes | Action |
|---|---|---|
| **Auth — refresh and retry once** | `-216`, `-220`, `-124`, `452` | Trigger token refresh, retry the call exactly once |
| **Auth — human required** | `-101`…`-105`, `-219`, `-135`, `-1351`, `112` | Stop. Alert. An admin must fix config or re-consent |
| **Transient / retryable** | `-32`, `-100`, `-144`, `-133`, `-234`, `-211` | Backoff + retry (respect the night window for `-133`/`-234`) |
| **Permanent for this payload** | `-201`, `-108`, `-1121`, `-1122`, `-230`, `-131`, `-114`, `-119` | Do not retry. Log with the payload, dead-letter it |

**Two OA codes are overloaded** — `-32` and `-223` each carry two distinct meanings. Branch on the `message` string, not the code alone.

### 14.2 Official Account API errors

| Code | Message | Meaning |
|---|---|---|
| `0` | Success | |
| `-32` | Your application reached limit call api | App exceeded requests/minute |
| `-32` | Your OA reached limit call api | OA exceeded its rate limit |
| `-100` | attachment_id was expired | Asset older than 7 days |
| `-200` | Send message failed | Generic send failure |
| `-201` | `<field>` is invalid! | Invalid parameter (field name interpolated) |
| `-204` | Offical Account is disable | OA deleted *(sic — Zalo's typo)* |
| `-205` | Offical Account is not exist | OA does not exist |
| `-209` | Not supported this api | App not activated for this API |
| `-210` | Parameter exceeds allowable limit | |
| `-211` | Out of quota | Feature usage quota exceeded |
| `-212` | App has not registed this api | OA has not registered this API |
| `-213` | User has not followed OA | |
| `-214` | Article is being processed | |
| `-216` | Access token is invalid | **Refresh** |
| `-217` | User has blocked invitation from OA | |
| `-218` | Out of quota receive | Per-recipient send limit exceeded |
| `-219` | App is removed or disabled | |
| `-220` | access_token is expired or removed | **Refresh** |
| `-221` | The OA needs to be verified to use this feature | |
| `-223` | Official Account has not authorized this API | |
| `-223` | Your OA has reach the limit quota create article | |
| `-224` | The OA needs to upgrade OA Tier Package | |
| `-227` | User is banned or has been inactive for more than 45 days | |
| `-230` | User has not interacted with the OA in the past 7 days | **7-day window violated** |
| `-232` | User has not interacted, or last interaction expired | |
| `-233` | message type is invalid or not support | |
| `-234` | This message cannot be sent at night (10:00PM - 6:00AM) | **Night ban** |
| `-235` | This API does not support this type of OA | |
| `-237` | The group is disabled | |
| `-238` | asset_id is already used / disabled | |
| `-240` | MessageV2 API has been shut down, please switch to MessageV3 | |
| `-241` | asset_id is already used | |
| `-242` | Invalid appsecret_proof provided in the API argument | |
| `-244` | User has restricted this message type from your OA | |
| `-248` | Violates our platform standards | Content policy violation |
| `-249` | Template does not support send via UID | |
| `-320` | Your app needs to connect with Zalo Cloud Account | |
| `-321` | Zalo Cloud Account out of money or unable to be charged | |
| `-403` | OA is not in group | |
| `-1340` | Cannot find this form | Zalo Ads form |
| `-1341` | Official Account has no access to this form | |

### 14.3 ZNS / ZBS errors

| Code | Meaning |
|---|---|
| `0` | Success |
| `-100` | Unknown error, retry later |
| `-101` | Application invalid |
| `-102` | Application does not exist |
| `-103` | Application not activated |
| `-104` | App secret key invalid |
| `-105` | Application not linked to any OA |
| `-106` | Method unsupported |
| `-107` | Message ID invalid |
| `-108` | **Phone number invalid** — use `84…` / `+84…` |
| `-109` | Template ID invalid |
| `-1091` | Cannot edit this template (not REJECT status, or Admin-tool-created) |
| `-110` | Zalo app version unsupported — user must update |
| `-111` | Template data empty |
| `-112` | Template data type not defined |
| `-1121` | Parameter data exceeds max length |
| `-1122` | Missing template parameter |
| `-1123` | QR code generation failed |
| `-1124` | Parameter has invalid format |
| `-113` | Button invalid |
| `-1131` | Invalid button content/link format |
| `-114` | **User cannot receive message** (account status, ZNS opt-out, old app version) |
| `-115` | **Out of quota / insufficient ZNS balance** |
| `-116` | Text/param content invalid |
| `-117` | **No permission to access template** (App/OA/template mismatch) |
| `-118` | Zalo account does not exist or is deactivated |
| `-119` | **Account cannot receive message** |
| `-120` | OA has no permission for this feature |
| `-1201` | OA cannot create tag-3 (promotion) templates |
| `-1202` | OA has no permission to use media resources |
| `-121` | Body data empty |
| `-122` | Body request is not valid JSON |
| `-123` | RSA message decode failed |
| `-124` | **Access token invalid** |
| `-1241` | `appsecret_proof` invalid |
| `-125` | **Official Account ID invalid** |
| `-126` | Out of quota (development-mode wallet) |
| `-127` | Test template can only be sent to administrators |
| `-128` | Encoding key does not exist |
| `-129` | RSA key generation failed |
| `-130` | Character limit exceeded (content > 100k chars) |
| `-131` | ZNS template not approved |
| `-132` | Parameter invalid |
| `-133` | **Cannot send at night (22:00–06:00)** |
| `-134` | User has not responded to ZNS opt-in *(no longer used)* |
| `-135` | OA has no permission to send ZNS (needs verification + paid plan) |
| `-1351` | System blocked OA from sending ZNS (violation) |
| `-136` | ZCA connection required |
| `-137` | ZCA charge failure / insufficient balance |
| `-138` | App has no permission for this feature |
| `-1381` | OA has not granted the Extension ZCA permission |
| `-139` | User refused this ZNS content type |
| `-140` | User ineligible for this ZNS type per delivery policy |
| `-141` | User refused ZNS from this OA |
| `-142` | RSA key does not exist → call key-gen |
| `-143` | RSA key already exists → call key-get |
| `-144` | **OA exceeded daily ZNS sending limit** |
| `-1441` | OA exceeded monthly promotion quota |
| `-145` | OA not allowed to send this ZNS content type |
| `-146` | **Template disabled due to low sending quality** |
| `-147` | Template exceeded its daily sending limit |
| `-1471` | OA exceeded monthly follow-up limit for this user |
| `-1472` | OA exceeded daily promotion limit for this user |
| `-148` | Journey token not found |
| `-149` | Journey token invalid |
| `-1491` | Journey token type incompatible |
| `-150` | Journey token expired |
| `-151` | Not an E2EE template |
| `-152` | Failed to get E2EE key |
| `-153` | Data violates specification |
| `-158` | File size exceeds limit |
| `-159` | Upload file format not allowed |
| `-160` | Daily quota for template create/edit or upload exceeded |
| `-161` | `sending_mode` has a disallowed value |
| `-162` | `sending_mode = 3` does not support tag 1 / tag 2 messages |

### 14.4 Social API errors

| Code | Message |
|---|---|
| `100` | Invalid parameter |
| `110` | Invalid user id |
| `111` | Can't resolve to a valid user ID |
| `112` | **Your app don't link with any Official Account** |
| `210` | User not visible |
| `289` | Accessing friend requests requires the extended permission read_requests *(dead — see §11.5)* |
| `452` | **Session key invalid** (bad format or user revoked access) — most common runtime failure |
| `2004` | Sending of requests has been temporarily disabled for this application |
| `2500` | Syntax error |
| `10000` | Call fail |
| `10001` | Method is not support for this api |
| `10002` | Unkown exception *(sic)* |
| `10003` | Item not exits *(sic)* |
| `11004` | App Id in use is disabled or banded *(sic)* |
| `12000` | Quota for your app is limited |
| `12001` | Limit of friends list is too large. Maximum: 50 *(dead)* |
| `12002` | Quota daily for your app is limited |
| `12003` | Quota weeky for your app is limited *(sic)* |
| `12004` | Quota monthly for your app is limited |
| `12006` | User has not played game for 30 days ago |
| `12007` | Do not disturb user (no contact for 30 days) |
| `12008` | Recipient reached quota for messages (1 per 3 days) |
| `12009` | Sender and Recipient is not friend *(dead)* |
| `12010` | Quota daily per user for your app is limited |
| `12011` | Your friend is not using app *(dead)* |
| `12012` | Your friend is using app *(dead)* |

*(Typos are Zalo's, reproduced verbatim so you can string-match them.)*

### 14.5 Additional error tables not reproduced here

Three surfaces carry **their own error tables** whose codes do not map onto the OA table. If you integrate them, read the table too:

| Surface | Where |
|---|---|
| Zalo Shop | `docs/zalo-shop/...` Shop-specific error appendix |
| Call-consent check | its own table on the consent-check page (§10.1) |
| ZaloPay | `docs.zalopay.vn` — an entirely separate scheme |

### 14.6 Mini App errors

| Code | Meaning |
|---|---|
| `-201` | User denied the permission request |
| `-202` | User denied and chose "don't ask again" |
| `-1400` | Bad request — invalid API parameters |
| `-1401` | User authentication required before requesting user permission |
| `-1403` | Permission not granted — request it in the App Management page |
| `-1404` | API not supported in this Zalo version |
| `-1408` | Request timeout |
| `-2002` | User previously denied and does not want to be asked again |

---
---

## 15. Rate limits and sending schedules

### 15.1 Rate limits

**Application level:**

| API | Limit |
|---|---|
| Official Account API | **4,000 requests/minute** |
| Article API | 4,000 requests/minute |
| Social API | 4,000 requests/minute **+ 20 requests/user/minute** |

**Response headers on every OA call:**

```
X-RateLimit-Limit:  <total permitted calls this minute>
X-RateLimit-Remain: <remaining>
```

Read and log these. The window resets each minute. Exceeding returns `-32`.

**OA level:** limits vary by **OA package tier**. The concrete numbers live in Zalo's pricing material, not the developer docs — `⚠️ not publicly enumerated`. ZBS Template Message is **excluded** from OA-level rate-limit accounting.

### 15.2 Endpoint-specific quotas

| Endpoint | Quota |
|---|---|
| OA upload image/file/gif | 5,000 requests/month |
| ZNS template create | 100/day |
| ZNS template edit | 100/day |
| ZNS image upload | 5,000/month/app |
| ZNS daily send | dynamic tier — see §7.11 |

### 15.3 Time-based sending restrictions

Two distinct mechanisms, frequently conflated: a **clock schedule** (what hour it is) and **elapsed-time windows** (how long since something happened).

#### The clock schedule — per message type

| Message type | Send window | Out-app push window | Blocked with |
|---|---|---|---|
| **Tin Tư vấn** — consultation / CS (`/v3.0/oa/message/cs`) | **24/24** | **24/24** | never |
| **Tin Giao dịch** — transaction (ZBS UID, Tag 1 / Tag 2) | **24/24** | **06:00 → 21:59** | never blocked, but push suppressed |
| **Tin Truyền thông** — promotional / broadcast (Tag 3) | **06:00 → 21:59** | 06:00 → 21:59 | `-234` |
| **Group chat (GMF)** | **24/24** | 24/24 | never |
| **ZBS/ZNS by phone** | per-template night flag | — | `-133` |

Sources: `official-account/tin-nhan/tin-tu-van/dieu-kien-gui-tin-tu-van` · `.../tin-giao-dich/dieu-kien-gui-tin-giao-dich` · `.../tin-truyen-thong/dieu-kien-gui-tin-truyen-thong` · `.../nhom-chat-gmf/tin-nhan/condition`.

**You can reply to a customer at 3am.** Consultation messages are documented `24/24` for both sending and push. A blanket night guard over all outbound traffic is wrong and will damage your support responsiveness.

**The transaction row is the subtle one.** A transaction message sent at 02:00 is accepted (`error: 0`) and delivered to the conversation, but the recipient's device shows **no notification** until the 06:00 window opens. It is not a failure and no error tells you about it — the message simply sits unseen. If timely arrival matters, schedule transaction sends inside 06:00–21:59 even though the API would accept them earlier.

**Error text vs conditions page.** `-234` reads *"10:00PM - 6:00AM"*; the linked conditions page states the allowed window as *"Từ 6h00 -> 21h59"*. These agree: blocked from 22:00:00 to 05:59:59.

> `⚠️ UNVERIFIED — timezone.` **No Zalo page states a timezone for the night window.** Every reference is a bare `22h–6h` / `6h00 -> 21h59`. Vietnam time (`Asia/Ho_Chi_Minh`, UTC+7, no DST) is the only sensible operational reading and is what §17.3 implements — but treat it as an assumption, and confirm with a boundary-time send before relying on it.

> `⚠️ UNVERIFIED — is -133 still live?` `-133` **does not appear in the new ZBS error table at all** (it jumps `-132` → `-1351`). The night restriction may have been dropped in the ZBS merge. Note also the wording difference: `-234` says *"Loại tin nhắn này"* (this message **type**) while `-133` says *"Mẫu ZNS này"* (**this template**) — implying the ZNS restriction is a per-template flag rather than an API-wide rule. Do not hard-code either assumption; handle `-133` as a reschedule and log whether it ever fires.

> `⚠️ OTP at night is unresolved.` No page grants authentication templates (`template_type: 2`) a night exemption, and none denies one either. An OTP that cannot be sent at 23:00 breaks login. **Test this explicitly with your own OTP template before shipping a nighttime auth flow** — and have an SMS fallback path ready if it fails.

#### Elapsed-time windows

| Window | Applies to | Expiry behaviour |
|---|---|---|
| **48 hours** | Free CS reply window from last interaction | Beyond it, CS sends are billable |
| **7 days** | CS eligibility from last interaction | `-230` |
| **1 year** | Interaction requirement for transaction messages | much longer than the CS window |
| **45 days** | User offline **on Zalo entirely** (not just with your OA) | `-227` — unreachable by anyone |
| **7 days** | Uploaded `attachment_id` / file `token` | `-100` |
| **10 minutes** | OAuth authorization code (single use) | re-authorize |
| **25 hours** | OA access token | refresh |
| **3 months** | OA refresh token | re-consent |
| **1 hour** | Social access token | refresh |
| **30 days** | Social refresh token (inherited TTL, §4.2) | re-authorize interactively |
| **2 minutes** | Mini App `getPhoneNumber()` token (single use) | re-request |
| **48 hours** | Voice call link `ttl: 172800` | mint a new link |
| **7 or 30 days** | ZNS journey tokens (`token_logistics_7` / `_30`, `token_coach_bus_7` / `_30`) | `-150` |

**Note the 8-free-CS-messages change.** The 48-hour window historically granted *8 free* consultation messages, reset by each new interaction. **From 2026-01-01 that became unlimited within the 48-hour window.** Read `cs_reply.remain` from the quota endpoint rather than assuming either model.

#### Frequency caps with a time component

| Cap | Value | Error |
|---|---|---|
| Promotional messages per user, per OA, per day | **1** | `-1472` |
| Promotional messages per user, per month | disputed — see below | `-1441` |
| Follow-up (hậu mãi) per user, per month | OA-level limit | `-1471` |
| Daily send requests, OA with ≤10,000 followers | **500/day** | `-144` |
| Daily send requests, OA with >10,000 followers | **5% of follower count per day** | `-144` |
| Per-template daily quota (when `applyTemplateQuota`) | varies | `-147` |
| API rate limit | 4,000 req/min, resets each minute | `-32` |

> `⚠️ CONFLICT` — the per-user monthly promotional cap is documented as **4/month** in one Zalo source and **30/month (1/day)** in another. Both are Zalo-affiliated. Do not build tight scheduling on either figure; treat `-1441` / `-1472` as authoritative at runtime.

The 5%-of-followers rule is the one that surprises growing accounts: **your daily send allowance scales with follower count**, so a campaign sized against last quarter's follower base can exceed today's cap.

#### Quality evaluation schedule

- **Evaluated hourly**, measured over the window *from the start of the day to now*
- Automatic penalty (reports > 2% of daily quota) applies **at most once per 00:00–24:00 day**
- Tier **increase**: 7 days at good quality **and** successful sends ≥ 2× current daily quota
- Tier **decrease**: 7 days at poor quality
- After any tier change there is a **7-day cooldown**; a brand-new OA is first evaluated on **day 8**
- Quota reset hour is **not documented** — midnight Vietnam time is the reasonable assumption

Because evaluation is hourly but penalties are daily-capped, a bad morning can cost you a tier by lunchtime and there is nothing you can do until tomorrow. Front-load your riskiest sends late in the day, not early.

## 16. Vietnamese text handling

A real, silent failure mode that no Zalo documentation mentions.

### 16.1 The problem

Vietnamese uses stacked diacritics, and Unicode can represent them two ways:

- **NFC (precomposed)** — `ế` is one codepoint
- **NFD (decomposed)** — `ế` is `e` + combining circumflex + combining acute, three codepoints

They render identically. Nothing in a UI, a log, or a database dump distinguishes them. But they have different lengths:

```
"Xin chào, đơn hàng của bạn đã được xác nhận"

  NFC:  43 codepoints  |  43 UTF-16 units  |  60 UTF-8 bytes
  NFD:  55 codepoints  |  55 UTF-16 units  |  70 UTF-8 bytes
```

**28% longer, same visible string.**

### 16.2 Why it reaches you

macOS and iOS historically normalize filenames and some clipboard paths to NFD. Text pasted from an Apple device, scraped from a PDF, or round-tripped through certain Java and .NET string handling can arrive decomposed. Your database will store it faithfully. Your validator will measure it faithfully. And then:

- A 1,900-character message your check passed arrives at Zalo as 2,400 and is rejected
- A ZNS `template_data` value under its `maxLength` returns `-1121 Parameter data exceeds max length`
- The failure is **data-dependent and unreproducible** — it only fires for specific user input, so it looks like a flaky API

### 16.3 The fix

Normalize to NFC at the boundary, then measure. One line per language:

```ts
// TypeScript / JavaScript
const text = raw.normalize("NFC");
```
```python
# Python
import unicodedata
text = unicodedata.normalize("NFC", raw)
```
```php
// PHP — requires ext-intl
$text = \Normalizer::normalize($raw, \Normalizer::FORM_C);
```

Apply it in **one place**: the moment text enters your Zalo client, before any length check. Not scattered at call sites.

### 16.4 Counting the right unit

Zalo's limits are stated in characters, not bytes. After normalizing:

| Language | Correct | Wrong |
|---|---|---|
| Python | `len(text)` | — |
| PHP | `mb_strlen($text, 'UTF-8')` | `strlen()` — counts bytes, over-rejects Vietnamese by ~40% |
| JS/TS | `[...text].length` | `text.length` — counts UTF-16 units; fine for Vietnamese after NFC, wrong for emoji |

If users can put emoji in your message bodies, `text.length` in JavaScript counts a single emoji as 2. Use the spread form.

### 16.5 Test fixtures

Include both forms in your test suite. A useful pair:

```
NFC:  "Nguyễn Thị Hoàng Anh"   (20 chars)
NFD:  "Nguyễn Thị Hoàng Anh"   (25 chars — visually identical)
```

Assert your validator produces the same verdict for both. If it does not, you have this bug.

## 17. Operational architecture

The API surface is the easy part. These are the pieces that decide whether the integration survives contact with production.

### 17.1 Everything outbound goes through a queue

Not for scale — for correctness. Four platform behaviours make direct synchronous sends untenable:

| Behaviour | Consequence |
|---|---|
| Night ban 22:00–06:00 | ~1/3 of the day is unsendable; work must defer, not fail |
| Daily quota tiers that move without warning (§7.10) | `-144` is routine, not exceptional |
| Rate limit `-32` at 4,000 req/min | Needs backpressure, not retries-in-a-loop |
| Webhook retries at 30s–1h | Inbound processing must be async anyway |

Minimum viable shape:

```
domain event → outbox row (committed with the business transaction)
             → dispatcher (respects night window + quota + rate limit)
             → Zalo API
             → result recorded against the outbox row
             → delivery webhook reconciles final state
```

Use a **transactional outbox**, not a direct enqueue. "Order confirmed" and "notification queued" must commit together, or you will ship orders nobody was told about.

### 17.2 Retry policy by error class

Map §14.1's four buckets to concrete behaviour:

| Class | Policy |
|---|---|
| Auth-refreshable (`-216`, `-220`, `-124`, `452`) | Refresh once, retry once, then escalate. **Never loop** — a refresh loop against a revoked grant will get the app rate-limited |
| Transient (`-32`, `-100`, `-211`) | Exponential backoff with jitter, cap ~5 attempts |
| Quota (`-144`, `-147`, `-1441`) | Reschedule to the next quota window (tomorrow), do not retry today |
| Night ban (`-133`, `-234`) | Reschedule to 06:05 Asia/Ho_Chi_Minh with jitter. Should only ever fire for promotional sends — if you see it on a CS message, your message-type routing is wrong |
| Permanent (`-201`, `-108`, `-230`, `-131`, `-114`, `-119`) | Dead-letter immediately with the full payload. Retrying is pure waste |

Jitter matters: without it, a night-ban backlog releases as a thundering herd at 06:00 and trips `-32` instantly.

### 17.3 The night window, correctly

The guard is **per message type** (§15.3) — a blanket block over all outbound traffic is wrong and suppresses customer-service replies that Zalo permits 24/24.

```python
from datetime import datetime, time as dtime, timedelta
from enum import Enum
from zoneinfo import ZoneInfo

VN = ZoneInfo("Asia/Ho_Chi_Minh")   # ASSUMPTION: Zalo never states the zone (§15.3)
OPEN, CLOSE = dtime(6, 0), dtime(22, 0)


class Kind(Enum):
    CS = "cs"                    # consultation — 24/24, never blocked
    GROUP = "group"              # GMF — 24/24
    TRANSACTION = "transaction"  # sends 24/24, but push suppressed outside the window
    PROMOTION = "promotion"      # blocked outside the window (-234)
    TEMPLATE_PHONE = "zns"       # per-template night flag (-133), treat as PROMOTION


ALWAYS_OK = {Kind.CS, Kind.GROUP}
PUSH_ONLY = {Kind.TRANSACTION}       # accepted at night, but arrives silently


def in_window(now=None) -> bool:
    t = (now or datetime.now(VN)).astimezone(VN).time()
    return OPEN <= t < CLOSE


def can_send(kind: Kind, now=None) -> bool:
    """Will Zalo accept this send right now?"""
    return kind in ALWAYS_OK or kind in PUSH_ONLY or in_window(now)


def will_notify(kind: Kind, now=None) -> bool:
    """Will the recipient actually get a push? Transaction messages sent at
    night are accepted and delivered, but silently — no error tells you."""
    return kind in ALWAYS_OK or in_window(now)


def next_window(now=None) -> datetime:
    now = (now or datetime.now(VN)).astimezone(VN)
    if in_window(now):
        return now
    target = now.replace(hour=6, minute=5, second=0, microsecond=0)
    return target if now.time() < OPEN else target + timedelta(days=1)
```

Two rules that follow from the table:

1. **Never defer a CS reply or a group message.** They are permitted around the clock; delaying them is self-inflicted.
2. **Defer transaction messages by policy, not by necessity.** `can_send()` returns `True` at 02:00, but `will_notify()` returns `False` — the message lands unseen. If arrival time matters, queue to `next_window()` anyway.

Compute in `Asia/Ho_Chi_Minh` explicitly. Vietnam does not observe DST, but your infrastructure might, and a hardcoded UTC offset will drift twice a year if your servers are elsewhere.

### 17.4 Idempotency and deduplication

Two directions, two mechanisms:

**Outbound** — the phone channel gives you `tracking_id`; derive it deterministically from the domain object:

```
tracking_id = "order-88213-shipped"     ✅ replay-safe, traceable in the webhook
tracking_id = uuid4()                   ❌ a retry becomes a second real message
```

The UID channel (§5.4) has **no `tracking_id`**. There, idempotency must live entirely in your outbox: a unique constraint on `(domain_object_id, template_id, intent)` is what stops a double send.

**Inbound** — dedupe on `message.msg_id` with a TTL store (Redis `SET NX EX 604800` — 7 days comfortably outstrips the 1-hour retry ladder). Management events without a `msg_id` key on `(event_name, timestamp, subject_id)`.

### 17.5 What to emit

Metrics that would have caught every failure mode in this document:

| Metric | Alert on |
|---|---|
| `zalo.token.rotation{scope,result}` | any failure — needs a human |
| `zalo.token.age_seconds{scope}` | > 20h for OA, > 50m for Social |
| `zalo.api.error{code,endpoint}` | rate change by class |
| `zalo.ratelimit.remain` | < 20% of limit |
| `zns.quota.remaining` / `zns.quota.daily` | ratio < 20% |
| `zns.quality{window}` | any value other than HIGH |
| `zalo.webhook.signature_variant{app_id\|oa_id}` | **which prefix matched** — resolves §23 item 1 from live data |
| `zalo.webhook.latency_ms` | p99 > 1s (the limit is 2s) |
| `zalo.outbox.deferred{reason}` | night-window / quota backlog depth |

The signature-variant counter is the cheapest way to settle the documented ambiguity: ship both, watch for a week, delete the loser.

### 17.6 Testing without a sandbox

Given §1.3, structure for testability rather than hoping for a test tenant:

1. **Transport seam.** Put every HTTP call behind one interface. A `FakeZaloTransport` that replays recorded fixtures lets the entire application be tested with no network.
2. **Record real responses once.** Capture genuine success and error envelopes from your dev OA and commit them as fixtures. Zalo's error bodies have quirks (typos, overloaded codes, string-typed numbers) that hand-written mocks will not reproduce.
3. **Development mode for the one live path.** ZBS dev mode (§11.5) sends real messages to admins at no charge — your only genuine end-to-end test.
4. **Webhook fixtures.** Save one real payload per `event_name`, plus its `X-ZEvent-Signature`. Signature verification is exactly the kind of code that passes a hand-written test and fails on real bytes.
5. **Assert the invariants.** Write tests that fail if someone introduces `Authorization: Bearer`, uses HMAC for the webhook signature, skips NFC normalization, or trusts an HTTP status code. Those four regressions are what §2 exists to prevent, and a test enforces it better than a heading does.
---

## 18. Reference implementation — TypeScript / Node

Runtime: Node 18+ (native `fetch`, `crypto`). Framework-agnostic core, with an Express webhook example.

### 18.1 Token store and OAuth client

```ts
// src/zalo/auth.ts
import crypto from "node:crypto";
import { ZaloError } from "./client";   // defined in §18.2

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number; // epoch ms
}

export interface TokenStore {
  load(scope: "oa" | "social", subjectId: string): Promise<TokenSet | null>;
  /** MUST be atomic. Called before the new access token is used. */
  save(scope: "oa" | "social", subjectId: string, t: TokenSet): Promise<void>;
  /** Distributed lock. Return a release fn. */
  lock(key: string): Promise<() => Promise<void>>;
}

const b64url = (b: Buffer) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** RFC 7636 S256, matching Zalo's own PHP SDK. Verifier is exactly 43 chars. */
export function makePkce() {
  const verifier = b64url(crypto.randomBytes(32));            // 43 chars
  const challenge = b64url(crypto.createHash("sha256").update(verifier, "ascii").digest());
  return { verifier, challenge };
}

export interface ZaloConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  store: TokenStore;
}

const OA_AUTHORIZE = "https://oauth.zaloapp.com/v4/oa/permission";
const OA_TOKEN     = "https://oauth.zaloapp.com/v4/oa/access_token";
const SOCIAL_AUTHORIZE = "https://oauth.zaloapp.com/v4/permission";
const SOCIAL_TOKEN     = "https://oauth.zaloapp.com/v4/access_token";

export function buildAuthorizeUrl(
  cfg: ZaloConfig,
  scope: "oa" | "social",
  challenge: string,
  state: string,
) {
  const base = scope === "oa" ? OA_AUTHORIZE : SOCIAL_AUTHORIZE;
  const q = new URLSearchParams({
    app_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    code_challenge: challenge,
    state,
  });
  return `${base}?${q}`;
}

async function tokenRequest(
  cfg: ZaloConfig,
  scope: "oa" | "social",
  body: Record<string, string>,
): Promise<TokenSet> {
  const url = scope === "oa" ? OA_TOKEN : SOCIAL_TOKEN;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // NOT a body field, NOT Basic auth. Zalo puts the secret in a header.
      secret_key: cfg.appSecret,
    },
    body: new URLSearchParams({ app_id: cfg.appId, ...body }),
  });

  const json: any = await res.json();
  if (!json.access_token) {
    throw new ZaloError(json.error ?? -1, json.message ?? "token request failed", json);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    // expires_in arrives as a STRING
    accessExpiresAt: Date.now() + Number(json.expires_in) * 1000,
  };
}

export function exchangeCode(
  cfg: ZaloConfig, scope: "oa" | "social", code: string, codeVerifier: string,
) {
  return tokenRequest(cfg, scope, {
    code, grant_type: "authorization_code", code_verifier: codeVerifier,
  });
}

/**
 * Refresh with single-flight + write-before-use.
 *
 * Zalo refresh tokens are SINGLE USE and ROTATING. If we obtain a new pair and
 * crash before persisting it, the grant is permanently lost and a human must
 * re-consent. Hence: save() must commit before we return.
 */
export async function getValidToken(
  cfg: ZaloConfig, scope: "oa" | "social", subjectId: string,
): Promise<string> {
  const SKEW_MS = scope === "oa" ? 5 * 3600_000 : 10 * 60_000; // 5h for OA, 10m for social

  let t = await cfg.store.load(scope, subjectId);
  if (!t) throw new Error(`No Zalo grant for ${scope}:${subjectId} — re-authorization required`);
  if (Date.now() < t.accessExpiresAt - SKEW_MS) return t.accessToken;

  const release = await cfg.store.lock(`zalo:refresh:${scope}:${subjectId}`);
  try {
    t = (await cfg.store.load(scope, subjectId))!;           // re-read under lock
    if (Date.now() < t.accessExpiresAt - SKEW_MS) return t.accessToken;

    const next = await tokenRequest(cfg, scope, {
      refresh_token: t.refreshToken, grant_type: "refresh_token",
    });
    await cfg.store.save(scope, subjectId, next);             // COMMIT before use
    return next.accessToken;
  } finally {
    await release();
  }
}

export function appSecretProof(accessToken: string, appSecret: string) {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}
```

### 18.2 API client with error classification

```ts
// src/zalo/client.ts
export class ZaloError extends Error {
  constructor(public code: number, message: string, public body?: unknown) {
    super(`Zalo error ${code}: ${message}`);
  }
  get isAuthRefreshable() { return [-216, -220, -124, 452].includes(this.code); }
  get isRetryable()       { return [-32, -100, -144, -211].includes(this.code); }
  get isNightBan()        { return [-133, -234].includes(this.code); }
  get needsHuman()        {
    return [-101, -102, -103, -104, -105, -219, -135, -1351, -320, -321, -136, -137, 112]
      .includes(this.code);
  }
}

const OA_BASE  = "https://openapi.zalo.me";
const ZNS_BASE = "https://business.openapi.zalo.me";

async function call<T>(url: string, init: RequestInit, token: string): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), access_token: token }, // bare header, not Bearer
  });

  const limit  = res.headers.get("x-ratelimit-limit");
  const remain = res.headers.get("x-ratelimit-remain");
  if (remain && Number(remain) < 100) {
    console.warn(`[zalo] rate limit low: ${remain}/${limit}`);
  }

  const body: any = await res.json();
  // Non-zero error arrives with HTTP 200. Never trust the status code.
  if (body.error !== 0) throw new ZaloError(body.error, body.message ?? "unknown", body);
  return body as T;
}

/** GET params go in a single JSON-encoded `data` query param. */
function dataQuery(params: Record<string, unknown>) {
  return `?data=${encodeURIComponent(JSON.stringify(params))}`;
}

export class ZaloClient {
  constructor(private token: () => Promise<string>) {}

  private async post<T>(base: string, path: string, body: unknown) {
    return call<T>(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, await this.token());
  }

  private async get<T>(base: string, path: string, params?: Record<string, unknown>) {
    const url = `${base}${path}${params ? dataQuery(params) : ""}`;
    return call<T>(url, { method: "GET" }, await this.token());
  }

  // ---- OA ----

  sendText(userId: string, text: string) {
    const body = nfc(text);                       // §16 — normalize, THEN measure
    if (charLen(body) > 2000) {
      throw new Error("OA text messages are capped at 2000 characters");
    }
    return this.post(OA_BASE, "/v3.0/oa/message/cs", {
      recipient: { user_id: userId },
      message: { text: body },
    });
  }

  sendImage(userId: string, imageUrl: string, caption?: string) {
    return this.post(OA_BASE, "/v3.0/oa/message/cs", {
      recipient: { user_id: userId },
      message: {
        ...(caption ? { text: caption } : {}),
        attachment: {
          type: "template",
          payload: {
            template_type: "media",
            elements: [{ media_type: "image", url: imageUrl }],
          },
        },
      },
    });
  }

  /**
   * ZBS template by UID — the proactive send path (§5.4).
   * NOTE: no tracking_id is accepted here. Persist the returned message_id
   * against your domain object BEFORE treating the send as complete, or you
   * have no way to correlate the delivery webhook.
   */
  async sendTemplateByUid(input: {
    userId: string;
    templateId: string;
    templateData: Record<string, string>;
  }) {
    const res = await this.post<{ data: {
      message_id: string; user_id: string; sent_time: string;
      quota: { quota_type: "purchase_quota" | "reward_quota"; remain: number };
    }}>(OA_BASE, "/v3.0/oa/message/template", {
      user_id: input.userId,
      template_id: input.templateId,
      template_data: normalizeValues(input.templateData),
    });
    return res;
  }

  /** Group message (§6.1). Free — no send quota, no interaction window. */
  sendGroupText(groupId: string, text: string) {
    return this.post(OA_BASE, "/v3.0/oa/group/message", {
      recipient: { group_id: groupId },
      message: { text: stripMentions(nfc(text)) },
    });
  }

  /** Broadcast (§5.5). Article payload only — attachmentId comes from the Article API. */
  broadcastArticle(attachmentId: string, target: {
    ages?: number[]; gender?: number[]; locations?: number[];
    cities?: number[]; platform?: number[];
  } = {}) {
    return this.post(OA_BASE, "/v2.0/oa/message", {
      recipient: { target },
      message: { attachment: { payload: {
        template_type: "media",
        elements: [{ media_type: "article", attachment_id: attachmentId }],
      }}},
    });
  }

  /** Reaction (§5.7). Zero cost, opens no billing window. */
  react(userId: string, messageId: string, icon = "/-strong") {
    return this.post(OA_BASE, "/v2.0/oa/message", {
      recipient: { user_id: userId },
      sender_action: { react_icon: icon, react_message_id: messageId },
    });
  }

  getUserDetail(userId: string) {
    return this.get(OA_BASE, "/v3.0/oa/user/detail", { user_id: userId });
  }

  /** offset is capped at 9951 by Zalo — segment by tag for larger OAs. */
  listFollowers(offset = 0, count = 50, extra: Record<string, unknown> = {}) {
    if (offset > 9951) throw new Error("Zalo caps user/getlist offset at 9951");
    return this.get(OA_BASE, "/v3.0/oa/user/getlist", { offset, count, ...extra });
  }

  getSendQuota(userId: string) {
    return this.post<{ data: {
      last_interaction: string;
      cs_reply: { remain: number; total: number };
    }}>(OA_BASE, "/v3.0/oa/quota/message", { user_id: userId });
  }

  /** Pre-flight the 48h / 7d policy windows before spending a send. */
  async canSendCs(userId: string) {
    const q = await this.getSendQuota(userId);
    const ageMs = Date.now() - Number(q.data.last_interaction);
    if (ageMs > 7 * 86400_000) return { ok: false as const, reason: "outside-7-day-window" };
    return {
      ok: true as const,
      billable: ageMs > 48 * 3600_000,
      quotaRemaining: q.data.cs_reply.remain,
    };
  }

  // ---- ZNS / ZBS ----

  sendZns(input: {
    phone: string;
    templateId: string;
    templateData: Record<string, string>;
    trackingId: string;
    devMode?: boolean;
  }) {
    if (input.trackingId.length > 48) throw new Error("tracking_id max 48 chars");
    return this.post<{ data: {
      msg_id: string; sent_time: string; sending_mode: string;
      quota: { dailyQuota: string; remainingQuota: string };
    }}>(ZNS_BASE, "/message/template", {
      phone: normalizeVnPhone(input.phone),
      template_id: input.templateId,
      template_data: input.templateData,
      tracking_id: input.trackingId,
      ...(input.devMode ? { mode: "development" } : {}),
    });
  }

  /** ZNS GET endpoints use ordinary query params, NOT the OA `data={json}` convention. */
  private async rawGet<T>(base: string, path: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return call<T>(`${base}${path}${qs ? `?${qs}` : ""}`, { method: "GET" }, await this.token());
  }

  znsStatus(messageId: string) {
    return this.rawGet<{ data: { status: -1 | 0 | 1; delivery_time: string } }>(
      ZNS_BASE, "/message/status", { message_id: messageId });
  }

  znsQuota() {
    return this.rawGet<{ data: { dailyQuota: number; remainingQuota: number } }>(
      ZNS_BASE, "/message/quota");
  }

  /** Poll daily. A drop here precedes a quota-tier demotion. */
  znsQuality() {
    return this.rawGet<{ data: { oaCurrentQuality: string; oa7dayQuality: string } }>(
      ZNS_BASE, "/quality");
  }

  znsTemplate(templateId: string) {
    return this.rawGet<{ data: {
      templateId: string; status: string; templateQuality: string;
      listParams: Array<{ name: string; require: boolean; type: string; maxLength: number }>;
    }}>(ZNS_BASE, "/template/info/v2", { template_id: templateId });
  }
}

export function normalizeVnPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0"))   d = "84" + d.slice(1);
  if (!d.startsWith("84")) d = "84" + d;
  return d;
}

/**
 * Normalize Vietnamese text to NFC before ANY length check (§16).
 * The same visible string is 43 chars composed and 55 decomposed.
 */
export const nfc = (s: string) => s.normalize("NFC");

/** Count graphemes-ish: text.length counts UTF-16 units and miscounts emoji. */
export const charLen = (s: string) => [...nfc(s)].length;

export function normalizeValues(o: Record<string, string>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, nfc(String(v))]));
}

/**
 * Group mentions are a STRING convention ([@user_id] / [@group_id]), so any
 * relayed user text containing that pattern is an @everyone injection (§6.1).
 */
export const stripMentions = (s: string) => s.replace(/\[@[^\]]*\]/g, "");
```

### 18.3 Webhook receiver (Express)

```ts
// src/zalo/webhook.ts
import express from "express";
import crypto from "node:crypto";

const app = express();

// CRITICAL: capture the raw body. Re-serializing JSON breaks the signature.
app.use("/zalo/webhook", express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Zalo's documented formula is sha256(appId + rawBody + timestamp + secret).
 * Community production code widely uses oa_id in place of appId, and Zalo's
 * own docs are ambiguous. Accept either; log which one matched so you can
 * narrow this once real traffic tells you the answer.
 */
function verifySignature(rawBody: Buffer, header: string | undefined, body: any): string | null {
  if (!header) return null;
  const mac = header.includes("=") ? header.split("=", 2)[1].trim() : header.trim();
  const raw = rawBody.toString("utf8");
  const ts  = String(body.timestamp ?? "");
  const secret = process.env.ZALO_APP_SECRET!;

  const candidates: Array<[string, string]> = [
    ["app_id", sha256Hex(process.env.ZALO_APP_ID! + raw + ts + secret)],
  ];
  const oaId = body.oa_id ?? body.recipient?.id ?? body.sender?.id;
  if (oaId) candidates.push(["oa_id", sha256Hex(String(oaId) + raw + ts + secret)]);

  for (const [which, digest] of candidates) {
    if (timingSafeEqual(digest, mac)) return which;
  }
  return null;
}

app.post("/zalo/webhook", async (req: any, res) => {
  const matched = verifySignature(req.rawBody, req.get("X-ZEvent-Signature"), req.body);
  if (!matched) {
    console.warn("[zalo] signature mismatch", { event: req.body?.event_name });
    return res.status(401).end();
  }
  console.debug(`[zalo] signature matched via ${matched}`);

  // Return 200 within 2 seconds. Do not process inline.
  // Retries land at 30s, 5m, 15m, 30m, 1h — so the queue consumer MUST be
  // idempotent, keyed on message.msg_id.
  await enqueue({
    idempotencyKey: req.body.message?.msg_id
      ?? `${req.body.event_name}:${req.body.timestamp}`,
    source: req.get("X-ZEvent-Server") === "ZNS" ? "zns" : "oa",
    event: req.body,
  });

  res.status(200).json({ ok: true });
});

declare function enqueue(job: unknown): Promise<void>;
```

---
---

## 19. Reference implementation — Python

Runtime: Python 3.11+, `httpx`. FastAPI for the webhook.

```python
# zalo/auth.py
from __future__ import annotations
import base64, hashlib, hmac, secrets, time
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx

Scope = Literal["oa", "social"]

OA_AUTHORIZE     = "https://oauth.zaloapp.com/v4/oa/permission"
OA_TOKEN         = "https://oauth.zaloapp.com/v4/oa/access_token"
SOCIAL_AUTHORIZE = "https://oauth.zaloapp.com/v4/permission"
SOCIAL_TOKEN     = "https://oauth.zaloapp.com/v4/access_token"


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def make_pkce() -> tuple[str, str]:
    """RFC 7636 S256. Verifier is exactly 43 chars, matching Zalo's requirement."""
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


@dataclass
class TokenSet:
    access_token: str
    refresh_token: str
    access_expires_at: float  # epoch seconds


class TokenStore(Protocol):
    def load(self, scope: Scope, subject_id: str) -> TokenSet | None: ...
    def save(self, scope: Scope, subject_id: str, t: TokenSet) -> None: ...
    def lock(self, key: str): ...  # context manager


class ZaloAuthError(Exception):
    pass


@dataclass
class ZaloAuth:
    app_id: str
    app_secret: str
    redirect_uri: str
    store: TokenStore

    def authorize_url(self, scope: Scope, challenge: str, state: str) -> str:
        base = OA_AUTHORIZE if scope == "oa" else SOCIAL_AUTHORIZE
        return httpx.URL(base, params={
            "app_id": self.app_id,
            "redirect_uri": self.redirect_uri,
            "code_challenge": challenge,
            "state": state,
        }).__str__()

    def _token_request(self, scope: Scope, form: dict[str, str]) -> TokenSet:
        url = OA_TOKEN if scope == "oa" else SOCIAL_TOKEN
        r = httpx.post(
            url,
            # The app secret goes in a HEADER. Not the body, not Basic auth.
            headers={"secret_key": self.app_secret},
            data={"app_id": self.app_id, **form},
            timeout=15,
        )
        j = r.json()
        if "access_token" not in j:
            raise ZaloAuthError(f"{j.get('error')}: {j.get('message')}")
        return TokenSet(
            access_token=j["access_token"],
            refresh_token=j["refresh_token"],
            # expires_in arrives as a STRING
            access_expires_at=time.time() + int(j["expires_in"]),
        )

    def exchange_code(self, scope: Scope, code: str, verifier: str) -> TokenSet:
        return self._token_request(scope, {
            "code": code,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        })

    def valid_token(self, scope: Scope, subject_id: str) -> str:
        """
        Single-flight refresh with write-before-use.

        Refresh tokens are single-use and rotating: obtaining a new pair and
        failing to persist it destroys the grant permanently.
        """
        skew = 5 * 3600 if scope == "oa" else 600

        t = self.store.load(scope, subject_id)
        if t is None:
            raise ZaloAuthError(f"no grant for {scope}:{subject_id}; re-authorization required")
        if time.time() < t.access_expires_at - skew:
            return t.access_token

        with self.store.lock(f"zalo:refresh:{scope}:{subject_id}"):
            t = self.store.load(scope, subject_id)          # re-read under lock
            assert t is not None
            if time.time() < t.access_expires_at - skew:
                return t.access_token

            nxt = self._token_request(scope, {
                "refresh_token": t.refresh_token,
                "grant_type": "refresh_token",
            })
            self.store.save(scope, subject_id, nxt)          # COMMIT before use
            return nxt.access_token


def appsecret_proof(access_token: str, app_secret: str) -> str:
    return hmac.new(app_secret.encode(), access_token.encode(), hashlib.sha256).hexdigest()
```

```python
# zalo/client.py
from __future__ import annotations
import json, re, unicodedata
from typing import Any, Callable

import httpx

OA_BASE  = "https://openapi.zalo.me"
ZNS_BASE = "https://business.openapi.zalo.me"

AUTH_REFRESHABLE = {-216, -220, -124, 452}
RETRYABLE        = {-32, -100, -144, -211}
NIGHT_BAN        = {-133, -234}
NEEDS_HUMAN      = {-101, -102, -103, -104, -105, -219, -135, -1351,
                    -320, -321, -136, -137, 112}


class ZaloError(Exception):
    def __init__(self, code: int, message: str, body: Any = None):
        super().__init__(f"Zalo error {code}: {message}")
        self.code, self.body = code, body

    @property
    def is_auth_refreshable(self) -> bool: return self.code in AUTH_REFRESHABLE
    @property
    def is_retryable(self) -> bool:        return self.code in RETRYABLE
    @property
    def is_night_ban(self) -> bool:        return self.code in NIGHT_BAN
    @property
    def needs_human(self) -> bool:         return self.code in NEEDS_HUMAN


def normalize_vn_phone(raw: str) -> str:
    d = re.sub(r"\D", "", raw)
    if d.startswith("0"):
        d = "84" + d[1:]
    if not d.startswith("84"):
        d = "84" + d
    return d


def nfc(s: str) -> str:
    """
    Normalize Vietnamese text before ANY length check.

    The same visible string is 43 codepoints composed and 55 decomposed;
    text pasted from Apple devices commonly arrives decomposed.
    """
    return unicodedata.normalize("NFC", s)


def strip_mentions(s: str) -> str:
    """Group mentions are a string convention — relayed user text can inject @everyone."""
    return re.sub(r"\[@[^\]]*\]", "", s)


class ZaloClient:
    def __init__(self, token_getter: Callable[[], str], client: httpx.Client | None = None):
        self._token = token_getter
        self._http = client or httpx.Client(timeout=20)

    def _request(self, method: str, url: str, **kw) -> dict:
        headers = {**kw.pop("headers", {}), "access_token": self._token()}
        r = self._http.request(method, url, headers=headers, **kw)

        remain = r.headers.get("X-RateLimit-Remain")
        if remain and int(remain) < 100:
            print(f"[zalo] rate limit low: {remain}/{r.headers.get('X-RateLimit-Limit')}")

        body = r.json()
        # Non-zero error comes back with HTTP 200. Status code means nothing here.
        if body.get("error") != 0:
            raise ZaloError(body.get("error", -1), body.get("message", "unknown"), body)
        return body

    def _get(self, base: str, path: str, data: dict | None = None) -> dict:
        params = {"data": json.dumps(data, ensure_ascii=False)} if data else None
        return self._request("GET", f"{base}{path}", params=params)

    def _post(self, base: str, path: str, payload: dict) -> dict:
        return self._request("POST", f"{base}{path}", json=payload)

    # ---- OA ----

    def send_text(self, user_id: str, text: str) -> dict:
        body = nfc(text)                       # normalize, THEN measure
        if len(body) > 2000:
            raise ValueError("OA text messages are capped at 2000 characters")
        return self._post(OA_BASE, "/v3.0/oa/message/cs", {
            "recipient": {"user_id": user_id},
            "message": {"text": body},
        })

    def send_image(self, user_id: str, image_url: str, caption: str | None = None) -> dict:
        msg: dict = {"attachment": {"type": "template", "payload": {
            "template_type": "media",
            "elements": [{"media_type": "image", "url": image_url}],
        }}}
        if caption:
            msg["text"] = caption
        return self._post(OA_BASE, "/v3.0/oa/message/cs",
                          {"recipient": {"user_id": user_id}, "message": msg})

    def send_template_by_uid(self, *, user_id: str, template_id: str,
                             template_data: dict[str, str]) -> dict:
        """
        ZBS template by UID — the proactive send path (:ref:`5.4`).

        No tracking_id is accepted on this channel. Persist the returned
        data.message_id against your domain object before treating the send as
        complete, or the delivery webhook cannot be correlated.
        """
        return self._post(OA_BASE, "/v3.0/oa/message/template", {
            "user_id": user_id,
            "template_id": template_id,
            "template_data": {k: nfc(str(v)) for k, v in template_data.items()},
        })

    def send_group_text(self, group_id: str, text: str) -> dict:
        """Group message. Free — no send quota, no interaction window."""
        return self._post(OA_BASE, "/v3.0/oa/group/message", {
            "recipient": {"group_id": group_id},
            "message": {"text": strip_mentions(nfc(text))},
        })

    def broadcast_article(self, attachment_id: str, **target) -> dict:
        """Broadcast. Article payload only — attachment_id comes from the Article API."""
        return self._post(OA_BASE, "/v2.0/oa/message", {
            "recipient": {"target": target},
            "message": {"attachment": {"payload": {
                "template_type": "media",
                "elements": [{"media_type": "article", "attachment_id": attachment_id}],
            }}},
        })

    def react(self, user_id: str, message_id: str, icon: str = "/-strong") -> dict:
        """Zero-cost acknowledgement. Consumes no quota, opens no billing window."""
        return self._post(OA_BASE, "/v2.0/oa/message", {
            "recipient": {"user_id": user_id},
            "sender_action": {"react_icon": icon, "react_message_id": message_id},
        })

    def user_detail(self, user_id: str) -> dict:
        return self._get(OA_BASE, "/v3.0/oa/user/detail", {"user_id": user_id})

    def list_followers(self, offset: int = 0, count: int = 50, **extra) -> dict:
        if offset > 9951:
            raise ValueError("Zalo caps user/getlist offset at 9951")
        return self._get(OA_BASE, "/v3.0/oa/user/getlist",
                         {"offset": offset, "count": count, **extra})

    def send_quota(self, user_id: str) -> dict:
        return self._post(OA_BASE, "/v3.0/oa/quota/message", {"user_id": user_id})

    def can_send_cs(self, user_id: str) -> dict:
        """Pre-flight the 48h/7d windows instead of discovering -230 the hard way."""
        import time
        q = self.send_quota(user_id)["data"]
        age = time.time() * 1000 - int(q["last_interaction"])
        if age > 7 * 86_400_000:
            return {"ok": False, "reason": "outside-7-day-window"}
        return {"ok": True,
                "billable": age > 48 * 3_600_000,
                "quota_remaining": q["cs_reply"]["remain"]}

    def upload_image(self, path: str) -> str:
        with open(path, "rb") as fh:
            r = self._http.post(
                f"{OA_BASE}/v2.0/oa/upload/image",
                headers={"access_token": self._token()},
                files={"file": fh},
            )
        body = r.json()
        if body.get("error") != 0:
            raise ZaloError(body["error"], body.get("message", ""), body)
        # NOTE: attachment_id expires after 7 days. Do not persist it long-term.
        return body["data"]["attachment_id"]

    # ---- ZNS / ZBS ----

    def send_zns(self, *, phone: str, template_id: str,
                 template_data: dict[str, str], tracking_id: str,
                 dev_mode: bool = False) -> dict:
        if len(tracking_id) > 48:
            raise ValueError("tracking_id max 48 chars")
        payload = {
            "phone": normalize_vn_phone(phone),
            "template_id": template_id,
            "template_data": template_data,
            "tracking_id": tracking_id,
        }
        if dev_mode:
            payload["mode"] = "development"
        return self._post(ZNS_BASE, "/message/template", payload)

    def zns_status(self, message_id: str) -> dict:
        return self._request("GET", f"{ZNS_BASE}/message/status",
                             params={"message_id": message_id})

    def zns_quota(self) -> dict:
        return self._request("GET", f"{ZNS_BASE}/message/quota")

    def zns_quality(self) -> dict:
        """Poll daily. A drop here precedes a quota-tier demotion."""
        return self._request("GET", f"{ZNS_BASE}/quality")

    def zns_template(self, template_id: str) -> dict:
        return self._request("GET", f"{ZNS_BASE}/template/info/v2",
                             params={"template_id": template_id})
```

```python
# zalo/webhook.py  — FastAPI
import hashlib, hmac, os
from fastapi import APIRouter, Request, Response

router = APIRouter()
APP_ID     = os.environ["ZALO_APP_ID"]
APP_SECRET = os.environ["ZALO_APP_SECRET"]


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _verify(raw: bytes, header: str | None, body: dict) -> str | None:
    """
    Documented: sha256(appId + rawBody + timestamp + secret) — plain digest, NOT HMAC.
    Community code widely uses oa_id instead of appId. Accept either, log which hit.
    """
    if not header:
        return None
    mac = header.split("=", 1)[1].strip() if "=" in header else header.strip()
    raw_s = raw.decode("utf-8")
    ts = str(body.get("timestamp", ""))

    candidates = [("app_id", _sha256_hex(APP_ID + raw_s + ts + APP_SECRET))]
    oa_id = (body.get("oa_id")
             or (body.get("recipient") or {}).get("id")
             or (body.get("sender") or {}).get("id"))
    if oa_id:
        candidates.append(("oa_id", _sha256_hex(str(oa_id) + raw_s + ts + APP_SECRET)))

    for which, digest in candidates:
        if hmac.compare_digest(digest, mac):
            return which
    return None


@router.post("/zalo/webhook")
async def zalo_webhook(request: Request) -> Response:
    raw = await request.body()          # raw bytes BEFORE any parsing
    body = await request.json()

    matched = _verify(raw, request.headers.get("X-ZEvent-Signature"), body)
    if matched is None:
        return Response(status_code=401)

    # Must return 200 within 2 seconds. Retries: 30s, 5m, 15m, 30m, 1h.
    # The consumer must be idempotent on msg_id.
    await enqueue({
        "idempotency_key": (body.get("message") or {}).get("msg_id")
                           or f"{body.get('event_name')}:{body.get('timestamp')}",
        "source": "zns" if request.headers.get("X-ZEvent-Server") == "ZNS" else "oa",
        "event": body,
    })
    return Response(status_code=200)
```

---
---

## 20. Reference implementation — PHP / Laravel

An official SDK exists: `composer require zaloplatform/zalo-php-sdk` (v4.0.4). It handles PKCE (`PKCEUtil::genCodeVerifier()` / `genCodeChallenge()`), the login URL (`$helper->getLoginUrl($cb, $challenge, $state)`), token exchange (`$helper->getZaloToken($verifier)`), and `appsecret_proof` (`$zalo->setUseAppSecretProof(true)`). It is v2.0-era for the API surface, so use it for **auth** and hand-roll the messaging calls.

```php
<?php
// app/Services/Zalo/ZaloAuth.php
namespace App\Services\Zalo;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ZaloAuth
{
    private const OA_AUTHORIZE     = 'https://oauth.zaloapp.com/v4/oa/permission';
    private const OA_TOKEN         = 'https://oauth.zaloapp.com/v4/oa/access_token';
    private const SOCIAL_AUTHORIZE = 'https://oauth.zaloapp.com/v4/permission';
    private const SOCIAL_TOKEN     = 'https://oauth.zaloapp.com/v4/access_token';

    public function __construct(
        private string $appId,
        private string $appSecret,
        private string $redirectUri,
    ) {}

    private static function b64url(string $bin): string
    {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    /** RFC 7636 S256 — mirrors zaloplatform/zalo-php-sdk PKCEUtil. */
    public static function makePkce(): array
    {
        $verifier  = self::b64url(random_bytes(32));            // 43 chars
        $challenge = self::b64url(hash('sha256', $verifier, true)); // RAW digest
        return ['verifier' => $verifier, 'challenge' => $challenge];
    }

    public function authorizeUrl(string $scope, string $challenge, string $state): string
    {
        $base = $scope === 'oa' ? self::OA_AUTHORIZE : self::SOCIAL_AUTHORIZE;
        return $base . '?' . http_build_query([
            'app_id'         => $this->appId,
            'redirect_uri'   => $this->redirectUri,
            'code_challenge' => $challenge,
            'state'          => $state,
        ]);
    }

    private function tokenRequest(string $scope, array $form): array
    {
        $url = $scope === 'oa' ? self::OA_TOKEN : self::SOCIAL_TOKEN;

        $res = Http::asForm()
            // The secret is a HEADER. Not a body field, not Basic auth.
            ->withHeaders(['secret_key' => $this->appSecret])
            ->timeout(15)
            ->post($url, array_merge(['app_id' => $this->appId], $form));

        $j = $res->json();
        if (!isset($j['access_token'])) {
            throw new ZaloException($j['error'] ?? -1, $j['message'] ?? 'token request failed');
        }

        return [
            'access_token'  => $j['access_token'],
            'refresh_token' => $j['refresh_token'],
            // expires_in is a STRING
            'expires_at'    => now()->addSeconds((int) $j['expires_in']),
        ];
    }

    public function exchangeCode(string $scope, string $code, string $verifier): array
    {
        return $this->tokenRequest($scope, [
            'code'          => $code,
            'grant_type'    => 'authorization_code',
            'code_verifier' => $verifier,
        ]);
    }

    /**
     * Single-flight refresh with write-before-use.
     * Refresh tokens are single-use and rotating — losing the new one kills the grant.
     */
    public function validToken(string $scope, string $subjectId): string
    {
        $skew = $scope === 'oa' ? 5 * 3600 : 600;

        $row = DB::table('zalo_tokens')->where(compact('scope'))
                 ->where('subject_id', $subjectId)->first();
        if (!$row) {
            throw new ZaloException(-1, "no grant for {$scope}:{$subjectId}");
        }
        if (now()->timestamp < strtotime($row->access_expires) - $skew) {
            return $row->access_token;
        }

        return Cache::lock("zalo:refresh:{$scope}:{$subjectId}", 30)->block(20, function ()
            use ($scope, $subjectId, $skew) {

            $row = DB::table('zalo_tokens')->where('scope', $scope)
                     ->where('subject_id', $subjectId)->first();
            if (now()->timestamp < strtotime($row->access_expires) - $skew) {
                return $row->access_token;
            }

            $next = $this->tokenRequest($scope, [
                'refresh_token' => $row->refresh_token,
                'grant_type'    => 'refresh_token',
            ]);

            // COMMIT before the new access token is used anywhere.
            DB::transaction(function () use ($scope, $subjectId, $next) {
                DB::table('zalo_tokens')
                  ->where('scope', $scope)->where('subject_id', $subjectId)
                  ->update([
                      'access_token'    => $next['access_token'],
                      'refresh_token'   => $next['refresh_token'],
                      'access_expires'  => $next['expires_at'],
                      'rotated_at'      => now(),
                  ]);
            });

            return $next['access_token'];
        });
    }

    public static function appsecretProof(string $accessToken, string $appSecret): string
    {
        return hash_hmac('sha256', $accessToken, $appSecret);
    }
}
```

```php
<?php
// app/Services/Zalo/ZaloClient.php
namespace App\Services\Zalo;

use Illuminate\Support\Facades\Http;

class ZaloException extends \RuntimeException
{
    // NOTE: do not declare a typed $code property — it collides with Exception::$code.
    // Use the inherited getCode(), and keep the raw body in a separate property.
    public function __construct(int $code, string $message, public mixed $body = null)
    {
        parent::__construct("Zalo error {$code}: {$message}", $code);
    }

    public function zaloCode(): int { return (int) $this->getCode(); }

    public function isAuthRefreshable(): bool { return in_array($this->zaloCode(), [-216,-220,-124,452], true); }
    public function isRetryable(): bool       { return in_array($this->zaloCode(), [-32,-100,-144,-211], true); }
    public function isNightBan(): bool        { return in_array($this->zaloCode(), [-133,-234], true); }
    public function needsHuman(): bool
    {
        return in_array($this->zaloCode(), [-101,-102,-103,-104,-105,-219,-135,-1351,
                                            -320,-321,-136,-137,112], true);
    }
}

class ZaloClient
{
    private const OA_BASE  = 'https://openapi.zalo.me';
    private const ZNS_BASE = 'https://business.openapi.zalo.me';

    /** @param callable():string $tokenGetter */
    public function __construct(private $tokenGetter) {}

    private function request(string $method, string $url, array $opts = []): array
    {
        $req = Http::withHeaders(['access_token' => ($this->tokenGetter)()])->timeout(20);

        $res = match ($method) {
            'GET'  => $req->get($url, $opts['query'] ?? []),
            'POST' => $req->asJson()->post($url, $opts['json'] ?? []),
        };

        $remain = $res->header('X-RateLimit-Remain');
        if ($remain !== '' && (int) $remain < 100) {
            logger()->warning("[zalo] rate limit low: {$remain}/{$res->header('X-RateLimit-Limit')}");
        }

        $body = $res->json();
        // Non-zero error arrives with HTTP 200.
        if (($body['error'] ?? -1) !== 0) {
            throw new ZaloException($body['error'] ?? -1, $body['message'] ?? 'unknown', $body);
        }
        return $body;
    }

    private function getData(string $base, string $path, array $data = []): array
    {
        $query = $data ? ['data' => json_encode($data, JSON_UNESCAPED_UNICODE)] : [];
        return $this->request('GET', $base . $path, ['query' => $query]);
    }

    // ---- OA ----

    public function sendText(string $userId, string $text): array
    {
        $body = self::nfc($text);              // normalize, THEN measure
        if (mb_strlen($body, 'UTF-8') > 2000) {
            throw new \InvalidArgumentException('OA text messages are capped at 2000 characters');
        }
        return $this->request('POST', self::OA_BASE . '/v3.0/oa/message/cs', ['json' => [
            'recipient' => ['user_id' => $userId],
            'message'   => ['text' => $body],
        ]]);
    }

    /**
     * ZBS template by UID — the proactive send path.
     * No tracking_id on this channel: persist data.message_id yourself.
     */
    public function sendTemplateByUid(string $userId, string $templateId, array $templateData): array
    {
        return $this->request('POST', self::OA_BASE . '/v3.0/oa/message/template', ['json' => [
            'user_id'       => $userId,
            'template_id'   => $templateId,
            'template_data' => array_map(fn($v) => self::nfc((string) $v), $templateData),
        ]]);
    }

    /** Group message. Free — no send quota, no interaction window. */
    public function sendGroupText(string $groupId, string $text): array
    {
        return $this->request('POST', self::OA_BASE . '/v3.0/oa/group/message', ['json' => [
            'recipient' => ['group_id' => $groupId],
            'message'   => ['text' => self::stripMentions(self::nfc($text))],
        ]]);
    }

    /** Reaction — zero cost, opens no billing window. */
    public function react(string $userId, string $messageId, string $icon = '/-strong'): array
    {
        return $this->request('POST', self::OA_BASE . '/v2.0/oa/message', ['json' => [
            'recipient'     => ['user_id' => $userId],
            'sender_action' => ['react_icon' => $icon, 'react_message_id' => $messageId],
        ]]);
    }

    public function userDetail(string $userId): array
    {
        return $this->getData(self::OA_BASE, '/v3.0/oa/user/detail', ['user_id' => $userId]);
    }

    public function sendQuota(string $userId): array
    {
        return $this->request('POST', self::OA_BASE . '/v3.0/oa/quota/message',
                              ['json' => ['user_id' => $userId]]);
    }

    /** Pre-flight the 48h/7d windows before spending a send. */
    public function canSendCs(string $userId): array
    {
        $d = $this->sendQuota($userId)['data'];
        $ageMs = (int) (microtime(true) * 1000) - (int) $d['last_interaction'];
        if ($ageMs > 7 * 86400000) {
            return ['ok' => false, 'reason' => 'outside-7-day-window'];
        }
        return ['ok' => true,
                'billable' => $ageMs > 48 * 3600000,
                'quota_remaining' => $d['cs_reply']['remain']];
    }

    // ---- ZNS / ZBS ----

    public static function normalizeVnPhone(string $raw): string
    {
        $d = preg_replace('/\D/', '', $raw);
        if (str_starts_with($d, '0'))  $d = '84' . substr($d, 1);
        if (!str_starts_with($d, '84')) $d = '84' . $d;
        return $d;
    }

    /** Normalize Vietnamese text before ANY length check. Requires ext-intl. */
    public static function nfc(string $s): string
    {
        return \Normalizer::normalize($s, \Normalizer::FORM_C) ?: $s;
    }

    /** Group mentions are a string convention — strip them from relayed user text. */
    public static function stripMentions(string $s): string
    {
        return preg_replace('/\[@[^\]]*\]/', '', $s);
    }

    public function sendZns(string $phone, string $templateId, array $templateData,
                            string $trackingId, bool $devMode = false): array
    {
        if (strlen($trackingId) > 48) {
            throw new \InvalidArgumentException('tracking_id max 48 chars');
        }
        $payload = [
            'phone'         => self::normalizeVnPhone($phone),
            'template_id'   => $templateId,
            'template_data' => $templateData,
            'tracking_id'   => $trackingId,
        ];
        if ($devMode) $payload['mode'] = 'development';

        return $this->request('POST', self::ZNS_BASE . '/message/template', ['json' => $payload]);
    }

    public function znsQuality(): array
    {
        return $this->request('GET', self::ZNS_BASE . '/quality');
    }
}
```

```php
<?php
// routes/web.php + app/Http/Controllers/ZaloWebhookController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ZaloWebhookController extends Controller
{
    public function handle(Request $request)
    {
        // getContent() returns the RAW body — do not use $request->all() for the digest.
        $raw  = $request->getContent();
        $body = json_decode($raw, true) ?: [];

        $matched = $this->verify($raw, $request->header('X-ZEvent-Signature'), $body);
        if ($matched === null) {
            return response()->noContent(401);
        }

        // 200 within 2 seconds. Retries: 30s, 5m, 15m, 30m, 1h.
        \App\Jobs\ProcessZaloEvent::dispatch(
            idempotencyKey: $body['message']['msg_id']
                ?? ($body['event_name'] ?? '') . ':' . ($body['timestamp'] ?? ''),
            source: $request->header('X-ZEvent-Server') === 'ZNS' ? 'zns' : 'oa',
            event: $body,
        );

        return response()->json(['ok' => true]);
    }

    /** Plain sha256 of a concatenated string — NOT hash_hmac. */
    private function verify(string $raw, ?string $header, array $body): ?string
    {
        if (!$header) return null;
        $mac = str_contains($header, '=') ? trim(explode('=', $header, 2)[1]) : trim($header);
        $ts  = (string) ($body['timestamp'] ?? '');
        $appId  = config('services.zalo.app_id');
        $secret = config('services.zalo.app_secret');

        $candidates = ['app_id' => hash('sha256', $appId . $raw . $ts . $secret)];
        $oaId = $body['oa_id'] ?? $body['recipient']['id'] ?? $body['sender']['id'] ?? null;
        if ($oaId) {
            $candidates['oa_id'] = hash('sha256', $oaId . $raw . $ts . $secret);
        }

        foreach ($candidates as $which => $digest) {
            if (hash_equals($digest, $mac)) return $which;
        }
        return null;
    }
}
```

---
---

## 21. cURL cookbook

```bash
# --- Environment ---------------------------------------------------------
export APP_ID="3608465248940903967"
export APP_SECRET="xxxxxxxxxxxxxxxxxxxx"
export TOKEN="<OA access token>"

# --- Exchange an authorization code for tokens ---------------------------
curl -X POST 'https://oauth.zaloapp.com/v4/oa/access_token' \
  -H "secret_key: $APP_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "code=<AUTH_CODE>&app_id=$APP_ID&grant_type=authorization_code&code_verifier=<VERIFIER>"

# --- Refresh (returns a NEW refresh token — save it) ---------------------
curl -X POST 'https://oauth.zaloapp.com/v4/oa/access_token' \
  -H "secret_key: $APP_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "refresh_token=<REFRESH>&app_id=$APP_ID&grant_type=refresh_token"

# --- OA: who am I --------------------------------------------------------
curl -H "access_token: $TOKEN" 'https://openapi.zalo.me/v2.0/oa/getoa'

# --- OA: check the send window BEFORE sending ----------------------------
curl -X POST 'https://openapi.zalo.me/v3.0/oa/quota/message' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"user_id":"3665924733554159312"}'

# --- OA: send a text consultation message --------------------------------
curl -X POST 'https://openapi.zalo.me/v3.0/oa/message/cs' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"recipient":{"user_id":"2512523625412515"},
       "message":{"text":"Xin chào từ API"}}'

# --- ZBS: send a template BY UID (cheaper than by phone) -----------------
curl -X POST 'https://openapi.zalo.me/v3.0/oa/message/template' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"user_id":"2512523625412515","template_id":"7895417a7d3f9461cd2e",
       "template_data":{"customer":"Nguyen Van A","order_code":"PE010299485"}}'

# --- OA: send into a group chat (free) -----------------------------------
curl -X POST 'https://openapi.zalo.me/v3.0/oa/group/message' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"recipient":{"group_id":"<GROUP_ID>"},"message":{"text":"Chào cả nhóm!"}}'

# --- OA: list the groups this OA owns ------------------------------------
curl --globoff -X GET \
  'https://openapi.zalo.me/v3.0/oa/group/getgroupsofoa?data={"offset":0,"count":5}' \
  -H "access_token: $TOKEN"

# --- OA: react to a message (zero cost, no billing window) ---------------
curl -X POST 'https://openapi.zalo.me/v2.0/oa/message' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"recipient":{"user_id":"<UID>"},
       "sender_action":{"react_icon":"/-strong","react_message_id":"<MSG_ID>"}}'

# --- OA: user detail (note --globoff for the braces) ---------------------
curl --globoff -X GET \
  'https://openapi.zalo.me/v3.0/oa/user/detail?data={"user_id":"4572947693969771653"}' \
  -H "access_token: $TOKEN"

# --- OA: list followers --------------------------------------------------
curl --globoff -X GET \
  'https://openapi.zalo.me/v3.0/oa/user/getlist?data={"offset":0,"count":50}' \
  -H "access_token: $TOKEN"

# --- OA: tag a follower --------------------------------------------------
curl -X POST 'https://openapi.zalo.me/v2.0/oa/tag/tagfollower' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"user_id": 2468458835296197922, "tag_name": "VIP"}'

# --- OA: upload an image (expires in 7 days) -----------------------------
curl -H "access_token: $TOKEN" -F "file=@/tmp/promo.jpg" \
  'https://openapi.zalo.me/v2.0/oa/upload/image'

# --- ZNS: current quota --------------------------------------------------
curl -H "access_token: $TOKEN" 'https://business.openapi.zalo.me/message/quota'

# --- ZNS: sending quality (poll daily, alert on drops) -------------------
curl -H "access_token: $TOKEN" 'https://business.openapi.zalo.me/quality'

# --- ZNS: template detail — validate params before sending ---------------
curl -H "access_token: $TOKEN" \
  'https://business.openapi.zalo.me/template/info/v2?template_id=7895417a7d3f9461cd2e'

# --- ZNS: send in DEVELOPMENT mode (admins only, no real charge) ---------
curl -X POST 'https://business.openapi.zalo.me/message/template' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"phone":"84987654321","template_id":"7895417a7d3f9461cd2e",
       "template_data":{"customer":"Nguyen Van A","cid":"PE010299485"},
       "tracking_id":"test-001","mode":"development"}'

# --- ZNS: send for real --------------------------------------------------
curl -X POST 'https://business.openapi.zalo.me/message/template' \
  -H "access_token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"phone":"84987654321","template_id":"7895417a7d3f9461cd2e",
       "template_data":{"customer":"Nguyen Van A","cid":"PE010299485"},
       "tracking_id":"order-88213"}'

# --- ZNS: delivery status ------------------------------------------------
curl -H "access_token: $TOKEN" \
  'https://business.openapi.zalo.me/message/status?message_id=a4d0243feee163bd3af2'

# --- Social: user profile (appsecret_proof is mandatory) -----------------
PROOF=$(printf '%s' "$USER_TOKEN" | openssl dgst -sha256 -hmac "$APP_SECRET" | awk '{print $2}')
curl -H "access_token: $USER_TOKEN" -H "appsecret_proof: $PROOF" \
  'https://graph.zalo.me/v2.0/me?fields=id,name,picture'
```

---
---

## 22. Implementation plan and go-live checklist

### 22.1 Provisioning — start this on day one, it gates development

Because there is no sandbox (§1.3), account provisioning is on the critical path, not a launch task.

- [ ] Zalo App created; `app_id` and `secret_key` captured
- [ ] Official Account created and **verification submitted** (this takes real calendar time)
- [ ] OA package purchased at the tier your features need — **Advanced or Premium if you want group chat (§7)**
- [ ] Zalo Cloud Account created, linked to the OA, and **funded** (required for any ZBS send)
- [ ] App ↔ OA linked in the console
- [ ] App toggled to **"Đang hoạt động"** (Quản lý ứng dụng → Cài đặt) — otherwise `-209` / `-14002`
- [ ] **Official Account API** registered (Quản lý ứng dụng → Đăng ký sử dụng API) — otherwise `-212`
- [ ] Domain or URL prefix verified (Quản lý ứng dụng → Xác thực domain)
- [ ] **Official Account Callback Url** + **Code Challenge** saved (Sản phẩm → Official Account → Thiết lập chung) — otherwise `-14003`
- [ ] All needed permission groups ticked **before** first consent — changing them later forces re-consent
- [ ] Webhook URL registered (HTTPS **domain**, not `host:port`)
- [ ] Token obtained once via **API Explorer** to unblock development (§4.1.3)
- [ ] ZBS templates drafted and **submitted for review** — approval is asynchronous and blocks your first real send

### 22.2 Build order

**Phase 1 — foundation**

- [ ] Config from secrets: `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_ID`, `ZALO_REDIRECT_URI`
- [ ] `zalo_tokens` table + migration (§4.3)
- [ ] OAuth redirect + callback with `state` CSRF validation and PKCE
- [ ] `getValidToken()` with distributed lock and write-before-use
- [ ] NFC normalization helper wired into the client boundary (§16.3)
- [ ] **Prove it:** complete OA consent, then `GET /v2.0/oa/getoa` and assert `is_verified`, `package_name`, `linked_ZCA`

**Phase 2 — one working send**

- [ ] `ZaloError` with the four-bucket classification, generated from `zalo-errors.json`
- [ ] `sendText()` against `/v3.0/oa/message/cs`
- [ ] Pre-flight via `/v3.0/oa/quota/message`
- [ ] **Prove it:** message yourself from an OA you interacted with in the last 48 hours

**Phase 3 — webhooks**

- [ ] Raw-body capture wired in *before* the JSON parser
- [ ] Signature verification accepting both `app_id` and `oa_id` prefixes, emitting the variant metric (§17.5)
- [ ] Enqueue-and-200 handler; idempotent consumer keyed on `msg_id`
- [ ] **Prove it:** message the OA from your phone, watch `user_send_text` land

**Phase 4 — proactive sending**

- [ ] Template approved and its `listParams` cached
- [ ] Client-side `template_data` validation against `listParams` before send
- [ ] **UID channel** (§5.4) with your own message-id mapping — remember there is no `tracking_id` here
- [ ] Phone channel (§11) with deterministic `tracking_id`
- [ ] Dev-mode path behind an env flag
- [ ] Route by price: prefer `price_uid` when a UID is known
- [ ] **Prove it:** dev-mode send to an admin, then one real send on each channel

**Phase 5 — the queue**

- [ ] Transactional outbox (§17.1)
- [ ] Retry policy by error class (§17.2)
- [ ] Night-window deferral in `Asia/Ho_Chi_Minh` with jitter (§17.3)
- [ ] Delivery-webhook reconciliation closing the loop on outbox rows

**Phase 6 — additional surfaces, as needed**

- [ ] Group chat (§7) — verify tier and GMF package first; strip `[@...]` from relayed text
- [ ] Article + broadcast (§13, §5.5) — Article state machine before broadcast
- [ ] Shop order webhooks → UID templates (§14)
- [ ] Voice calling (§15) — consent flow before call UX

**Phase 7 — operations**

- [ ] Daily `GET /quality` poll, alert on non-`HIGH`
- [ ] `change_oa_daily_quota` webhook → alert
- [ ] `change_template_status` webhook → surfaced to template authors
- [ ] All metrics in §17.5 emitting
- [ ] Token-rotation audit log; refresh failure pages a human

### 22.3 Pre-launch checklist

- [ ] Secrets in a secret manager, none in source or client bundles
- [ ] Webhook returns 200 in well under 2s under load
- [ ] Webhook consumer idempotent — tested by replaying one event five times
- [ ] Token refresh tested by artificially expiring a token
- [ ] Token refresh tested under concurrency (two workers, one lock)
- [ ] Refresh-failure alert reaches a human, not a retry loop
- [ ] `-230`, `-114`, `-115`, `-131`, `-144` each have a distinct, tested handling path
- [ ] Phone normalization unit-tested: `0987…`, `84987…`, `+84 987…`, `(+84) 987-654-321`
- [ ] **NFC/NFD fixture pair asserts an identical verdict** (§16.5)
- [ ] Night-window guard tested at 21:59, 22:01, 05:59, 06:01 Asia/Ho_Chi_Minh
- [ ] Uploaded-asset re-upload path tested (`attachment_id` expires in 7 days)
- [ ] 30-day Social re-authorization UX exists and has been walked through
- [ ] Invariant regression tests in place (§17.6 item 5)
- [ ] Every `⚠️ UNVERIFIED` item in §23 confirmed or feature-flagged

### 22.4 Data-handling policy constraints

Zalo's platform policy imposes obligations that affect architecture, not just legal copy:

- Explicit user consent before collecting personal data
- **Processing only on servers within Vietnamese territory** — a hosting-region constraint, decide it before you pick a region
- Delete all user data within **24 hours** of service cessation
- No third-party sharing; data usable only within the collecting app
- Honour access / deletion / withdrawal rights — there is a **data-subject-rights webhook** (§13.5) and a delete-follower-data endpoint, so this is an implementable requirement, not a policy statement
- TLS 1.2+ on Social API and Article API calls

Prohibited at app review: offensive app names, trademarked names without proof, violent or explicit icons, pre-filled user content, automated messaging without consent.
---

## 23. Unverified claims — confirm before relying on these

Every item appeared in Zalo's docs ambiguously, contradicted itself across pages, or came only from third-party sources. Each has a stated resolution path.

### 23.1 Resolved since the first draft

| Claim | Resolution |
|---|---|
| `dev-openapi.zalo.me` is a sandbox | ❌ **Wrong.** Appears in no Zalo doc or sitemap entry. There is no OA sandbox (§1.3) |
| Store APIs at `/v3.0/store/*` | ❌ **Wrong.** They are `/v2.0/mstore/*` (§14) |
| Article API at `/v3.0/article/*` | ❌ **Wrong.** It is `/v2.0/article/*` (§13) |
| ZBS replaces UID messages with phone-only sending | ❌ **Incomplete.** ZBS has a UID channel at `/v3.0/oa/message/template` (§5.4) |

### 23.2 Open

| # | Claim | Status | How to resolve |
|---|---|---|---|
| 1 | Webhook signature uses `app_id` as first term | Contradicted by community code using `oa_id` | Accept both, emit the variant metric (§17.5), narrow after a week of live traffic |
| 2 | Social refresh token lasts 30 days | SDK pages say 3 months | Assume 30 days; instrument actual expiry |
| 3 | PKCE mandatory for the OA flow | Docs mention `code_challenge`; a working library sends none | Implement it regardless — costs nothing |
| 4 | `code_challenge_method` param | Not documented; appears absent | Do not send it |
| 5 | `user_id_by_app` == Social `/v2.0/me` `id` | Community assertion only | Test with one real account. **Reliable alternative:** route users through a Mini App once and read `id` + `idByOA` together (§12.1) |
| 6 | `gender` field on `/v2.0/me` | Not in any current doc | Test; do not depend on it |
| 7 | OA upload paths are v2.0 vs v3.0 | Docs say v2.0, a community lib uses v3.0 | Use v2.0 |
| 8 | `list` message template on v3.0 | No doc page; only a webhook event name | Treat as unavailable |
| 9 | `appsecret_proof` enforced beyond `graph.zalo.me` | Mandate documented on Mini App page only | Per-endpoint flag |
| 10 | ZBS `campaign_id` field | No first-party evidence | Gateway-only field; do not send |
| 11 | Per-second / TPS rate limit | Not documented | Throttle client-side anyway |
| 12 | Which quota ladder applies post-merger | ZNS and ZBS docs describe different ladders | Read `dailyQuota` from `/message/quota`; never hardcode |
| 13 | Full string enum for `listParams[].type` | Only `"STRING"` observed | Handle unknown values gracefully |
| 14 | ZNS webhook retry count (10 vs 5) | Third-party mirror vs Zalo's page | Assume at-least-once regardless |
| 15 | Per-OA-tier rate limits | Not publicly enumerated | Read `X-RateLimit-Limit` at runtime |
| 16 | `/rating/get` accepts GET as well as POST | Zalo's own example is inconsistent | Use POST |
| 17 | `graph.zalo.me` vs `graph.zaloapp.com` | Docs use the former, Zalo's PHP SDK the latter | Prefer `graph.zalo.me` |
| 18 | **GMF management verb paths** (§6.2 lower rows) | Doc pages exist; literal paths not extracted | Fetch `official-account/nhom-chat-gmf/quan-ly/*` before implementing |
| 19 | **Custom user field paths** (§5.11) | Same — pages exist, paths not extracted | Fetch the index first |
| 20 | **`graph.zalo.me/v2.0/me/info`** for phone exchange (§12.2) | Could not re-confirm from a server-rendered source | Verify before shipping checkout |
| 21 | **Mini App checkout server host** (§12.3) | No merchant server host published | Reconcile via ZaloPay `/v2/query` instead of trusting the client callback |
| 22 | **Mini App eKYC and journey-messaging endpoints** | Pages exist; not enumerated here | Fetch `docs.zaloplatforms.com/docs/MA/*` if needed |
| 23 | OA quota v3.0 body-overload shapes (§5.13) | Two request shapes on one path | Wrap each in a named method; verify both against a real OA |
| 24 | **Night-window timezone** | No Zalo page states one — bare `22h–6h` everywhere | Assume `Asia/Ho_Chi_Minh`; confirm with a boundary-time send |
| 25 | **Is `-133` still live under ZBS?** | Absent from the new ZBS error table entirely | Handle it as a reschedule; log whether it ever fires |
| 26 | **OTP templates exempt from the night window?** | Neither granted nor denied in any doc | **Test with your own OTP template before shipping nighttime auth**; keep an SMS fallback |
| 27 | Per-user monthly promotional cap | Zalo sources say both **4/month** and **30/month** | Do not schedule against either; trust `-1441` / `-1472` at runtime |
| 28 | Daily quota reset hour | Undocumented | Midnight VN time is the reasonable assumption |
| 29 | Exact-vs-prefix matching of the saved OA Callback Url | Undocumented | Echo the console value byte-for-byte; the question then does not arise |
| 30 | Whether a **Web platform** under Đăng nhập is also needed for the OA flow | Docs scope that screen to Social login only, but one third-party guide configures both | Cheap to add if `-14003` survives step 4 of §4.1.1 |
| 31 | Rest of the `-14xxx` family | Only `-14002` and `-14003` are attested anywhere | Log the full error body; `error_name` is the only signal |

**Definitively NOT available** — do not spend time looking:

- Friend list, invitable friends, graph share API (Social) — removed
- Official Zalo Login **JavaScript SDK** — never existed; web login is a server-side redirect
- SMS fallback on ZBS — an aggregator feature (Infobip / 8x8 / eSMS / Goby), not Zalo's API
- UID transaction and personal-promotion messages — shut down 2026-03-01
- **An OA sandbox or simulator** — does not exist
- **A follow-invitation send API** — growth runs through Zalo's website widget; consent arrives by webhook
- **Posting into a group your OA did not create** — group messaging requires an OA-owned group
- **Free-text broadcast** — broadcast carries an Article payload only
---

## 24. Source index

**Primary (server-rendered mirrors of `developers.zalo.me`):**

- OA docs — https://docs.zaloplatforms.com/docs/OA
- OA auth — https://docs.zaloplatforms.com/docs/OA/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
- OA OAuth code types — https://docs.zaloplatforms.com/docs/OA/phu-luc/cac-loai-ma-su-dung-trong-oauth
- OA error codes — https://docs.zaloplatforms.com/docs/OA/phu-luc/ma-loi
- OA rate limits — https://docs.zaloplatforms.com/docs/OA/phu-luc/gioi-han-toc-do-api
- OA webhooks — https://docs.zaloplatforms.com/docs/OA/webhook/tong-quan
- OA interaction definitions — https://docs.zaloplatforms.com/docs/OA/phu-luc/cac-tuong-tac-cua-nguoi-dung-voi-oa
- Social API overview — https://docs.zaloplatforms.com/docs/Social/social-api/tai-lieu/tong-quan
- Social user access token v4 — https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/user-access-token-v4
- Social refresh-token expiry — https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/co-che-het-han-cua-user-refresh-token
- Social profile fields — https://docs.zaloplatforms.com/docs/Social/social-api/tai-lieu/thong-tin-ten-anh-dai-dien
- Social error codes — https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/ma-loi
- Social DPoP — https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/dpop
- Platform policy — https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/chinh-sach-nen-tang-cua-zalo
- Mini App auth best practice — https://docs.zaloplatforms.com/docs/MA/intro/best-practices/authen-user
- Mini App `getUserInfo` — https://docs.zaloplatforms.com/docs/MA/api/user/user-information/getUserInfo
- Mini App `getPhoneNumber` — https://docs.zaloplatforms.com/docs/MA/api/user/user-information/getPhoneNumber
- Mini App error codes — https://docs.zaloplatforms.com/docs/MA/api/errorCode

**ZNS (static CDN mirror — the `/index.html` suffix is required):**

- ZNS intro — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/bat-dau/gioi-thieu-zalo-notification-service-api/index.html
- Send ZNS — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/gui-tin-zns/gui-zns/index.html
- Development mode — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/gui-tin-zns/gui-zns-su-dung-development-mode/index.html
- Hash phone — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/gui-tin-zns/gui-zns-su-dung-hash-phone/index.html
- RSA — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/gui-tin-zns/gui-zns-voi-he-ma-hoa-rsa/index.html
- Message status — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/truy-xuat-thong-tin/lay-thong-tin-trang-thai-zns/index.html
- Quota — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/truy-xuat-thong-tin/lay-thong-tin-quota-zns/index.html
- Template detail — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/truy-xuat-thong-tin/lay-thong-tin-chi-tiet-template/index.html
- Create template — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/quan-ly-tai-san/tao-template/index.html
- Component limits — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/phu-luc/component/index.html
- Quality mechanism — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/phu-luc/co-che-danh-gia-chat-luong-va-quyen-loi-gui-zns/index.html
- ZNS error codes — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/phu-luc/bang-ma-loi/index.html
- ZNS delivery webhook — https://stc-developers.zdn.vn/docs/v2/zalo-notification-service/webhook/su-kien-nguoi-dung-nhan-thong-bao-zns/index.html
- ZBS Template Message send — https://stc-developers.zdn.vn/docs/v2/zbs-template-message/gui-tin-template-qua-sdt/api-gui-tin-qua-sdt/api-gui-tin/index.html
- Doc sitemap — https://stc-developers.zdn.vn/docs/sitemap.xml

**Newly covered surfaces (v2 of this document):**

- ZBS Template Message hub — https://docs.zaloplatforms.com/docs/ZBS
- ZBS send by UID — `.../zbs-template-message/gui-tin-template-qua-uid/api-gui-tin-qua-uid`
- ZBS UID sending rules — `.../zbs-template-message/gui-tin-template-qua-uid/quy-dinh-gui-tin-qua-uid`
- ZBS permission groups — `.../zbs-template-message/bat-dau/gioi-thieu-ve-cac-nhom-quyen-...`
- Broadcast — `.../official-account/tin-nhan/tin-truyen-thong/gui-tin-truyen-thong-broadcast`
- Group chat (GMF) management index — `.../official-account/nhom-chat-gmf/quan-ly/`
- Anonymous-user messaging — `.../official-account/tin-nhan/cac-loai-tin-khac/gui-tin-nhan-*-den-nguoi-dung-an-danh`
- Article API — `.../official-account/quan-ly/` article family, plus `noi-dung-dang-video/*`
- Zalo Shop — `https://stc-developers.zdn.vn/docs/v2/zalo-shop/api/...` + `phu-luc/su-kien-don-hang`
- Voice/video calling — `.../official-account/goi-thoai/`
- OA package purchase — `.../official-account/quan-ly/mua-san-pham-dich-vu-oa/`
- Ads lead forms — `.../official-account/quan-ly/` form family
- Custom user fields — `.../official-account/quan-ly/quan-ly-truong-thong-tin-nguoi-dung/`
- Mini App checkout SDK — https://docs.zaloplatforms.com/docs/MA/checkoutSdk
- ZaloPay — https://docs.zalopay.vn/ · https://developers.zalopay.vn/v2/general/overview.html

**Appendix pages that are load-bearing for payloads:**

- `phu-luc/cau-truc-cua-tham-so-buttons` · `phu-luc/cau-truc-cua-tham-so-elements`
- `phu-luc/ma-tai-san-asset_id-la-gi` · `phu-luc/cac-trang-thai-cua-video`
- `phu-luc/cac-tuong-tac-cua-nguoi-dung-voi-oa` · `phu-luc/huong-dan-xac-thuc-domain`

**OA console configuration (the `-14003` trail):**

- OA auth flow, Bước 1–4 — https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
  (mirror: https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new/index.html)
- Domain verification — `.../official-account/phu-luc/huong-dan-xac-thuc-domain` — prefix semantics, 20-domain / 20-URL / 75-char caps, and the tunnel-host exemption (localtunnel.me, ngrok.io, localhost.run, serveo.net skip verification entirely)
- `official-account-api/phu-luc/official-account-callback-url` — **deleted from the docs**; still cited in community threads
- Community threads evidencing the `-14xxx` family: `community/detail/81dd56256a60833eda71` (`-14003 Invalid redirect uri`), `community/detail/63fa901eac5b45051c4a` and `.../81f4e20ede4b37156e5a` (`-14002 Invalid appId / App is not active but user is not admin`)

**Official SDKs:**

- PHP SDK — https://github.com/zaloplatform/zalo-php-sdk (PKCE reference implementation: `src/Util/PKCEUtil.php`)
- Java SDK — https://github.com/zaloplatform/zalo-java-sdk
- .NET SDK — includes a dedicated `article-api` page and `official-account-api-v3`
- Android / iOS SDKs — additionally expose app-level send-to-friends, post-article, invite-to-app

**Canonical (JS-rendered; use the mirrors above for machine reading):**

- https://developers.zalo.me/docs
- https://developers.zalo.me/community — community threads are the best source on the webhook-signature ambiguity

---

*Compiled 2026-08-20 from Zalo's official documentation. Zalo ships breaking changes without versioned changelogs — re-verify §1 and §23 before any major release.*

*Compiled 2026-08-20 from Zalo's official documentation. Zalo ships breaking changes without versioned changelogs — re-verify §1 and §23 before any major release.*
