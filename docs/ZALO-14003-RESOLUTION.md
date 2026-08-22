# `-14003 Invalid redirect uri` — root cause and fix

**Status:** root cause identified
**Date:** 2026-08-21
**Supersedes:** the "Hypotheses, untested" section of `ZALO-14003-ISSUE.md`

---

## Root cause

**The OA authorization flow is not a dynamic, per-request OAuth redirect.** `redirect_uri`
and `code_challenge` are **saved settings in the developer console**. Zalo then *generates*
the consent link from them, and you send that fixed link to the OA admin.

Our `/api/zalo/connect` route builds its own authorize URL with a `redirect_uri` we invent
at request time. Zalo has no record of that URI, so `-14003` is Zalo being accurate: the
redirect URI genuinely is not registered.

Zalo's own words — `bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new`, **Bước 2**:

> *"Truy cập Zalo for Developers để thiết lập đường dẫn yêu cầu cấp quyền. Tại bước này,
> bạn cần thiết lập callback URL và tham số code challenge vừa được tạo ở bước 1."*
>
> (Go to Zalo for Developers to set up the authorization request path. At this step you
> must set the callback URL and the code challenge parameter just created in step 1.)

**Bước 3**:

> *"Sao chép đường dẫn yêu cầu cấp quyền và gửi đến admin của OA để bắt đầu quá trình
> nhận authorization code."*
>
> (Copy the authorization request link and send it to the OA admin to begin obtaining
> the authorization code.)

Note also: `/v4/oa/permission` **never appears in Zalo's OA documentation**. Every mention
of `oauth.zaloapp.com` in the OA docs is `/v4/oa/access_token`. The permission URL is not
documented because you are not meant to build it.

### Why domain verification did not help

Two separate mechanisms, repeatedly conflated:

| Mechanism | Where | What it does |
|---|---|---|
| Domain / URL-prefix verification | Quản lý ứng dụng → Xác thực domain | Proves you **own** the hostname |
| **Official Account Callback Url** | **Sản phẩm → Official Account → Thiết lập chung** | **Allowlists the callback `-14003` checks against** |
| App Callback Url | Đăng nhập → Thêm nền tảng → Web | Social/Login API only (`/v4/permission`) |

We had done the first only. Hypothesis 3 in the original issue was correct.

### Why this was hard to find

The console screen is documented **only as screenshots with no alt text**, so it is
invisible to search engines and to anyone reading the JS-rendered docs site. The page that
used to explain it — `official-account-api/phu-luc/official-account-callback-url` — has
been **deleted**; it is still cited in community threads but is absent from the current
sitemap. The current auth page compresses the whole thing into one vague sentence.

---

## Fix

### 1. Collapse PKCE to a single fixed pair

Because the challenge is stored in the console, the matching verifier is a **long-lived
config value**, not a per-request secret.

```bash
node -e '
const c=require("crypto");
const b=b=>b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const v=b(c.randomBytes(32));
console.log("ZALO_PKCE_VERIFIER =", v);
console.log("code_challenge     =", b(c.createHash("sha256").update(v,"ascii").digest()));
'
```

Put the verifier in Vercel as `ZALO_PKCE_VERIFIER`. Keep the challenge for step 2.

> ⚠️ **This is a second, latent bug.** `createPkce()` currently mints a fresh pair per
> request and stashes the verifier in a cookie. That is textbook RFC 7636 and correct for
> Zalo's **Social** flow — but on the OA flow it fails at `/v4/oa/access_token`, because
> the console holds a fixed challenge our per-request verifier can never match. It would
> have surfaced *after* `-14003` was fixed and looked like an unrelated regression.

### 2. Register the callback in the console

```
developers.zalo.me → [app 1397345074596379506]
  → Sản phẩm → Official Account → Thiết lập chung
      Official Account Callback Url : https://jerkchillapp.vercel.app/api/zalo/callback
      Code Challenge                : <challenge from step 1>
      Permission groups             : tick everything we will need — see below
      → Lưu
```

**Tick every group now.** Changing the callback URL *or* the permission set **invalidates
the grant** and forces the OA admin to re-consent. For this project that means at minimum:

- Quyền gửi tin và thông báo qua OA
- Quyền quản lý tin nhắn người dùng
- Quyền quản lý thông tin OA
- Quyền nhận sự kiện quản lý tin nhắn
- Quyền nhận sự kiện quản lý người dùng
- the ZBS groups, if booking-confirmation templates are ever enabled

### 3. Use the console-generated link

Copy the link the console produces. Do **not** reconstruct it. `/api/zalo/connect` should
serve the stored link (or redirect to it), not build one from parts.

### 4. Confirm the prerequisite chain

Neither of these was on the original tried-list, and each fails opaquely:

| Step | Console path | Error if missing |
|---|---|---|
| App activated | Quản lý ứng dụng → Cài đặt → *"Chưa kích hoạt"* → *"Đang hoạt động"* | `-209`, `-14002` |
| OA API product registered | Quản lý ứng dụng → Đăng ký sử dụng API → Official Account API | `-212` |

`-209 "Not supported this api"` is badly named — it means **the app is not activated**, not
that the endpoint is unsupported.

---

## Unblock immediately, without any of the above

**Tools & Support → API Explorer** → select the app → token type **"OA Access Token"** →
select the OA → Allow → copy **both** the access token and the refresh token.

Seed `zalo_tokens` with that pair and the entire send path — group messages, webhooks,
quota — becomes testable right now. Given there is no Zalo sandbox at all, this is the most
useful unblocking tool on the platform, and it is buried in a menu. Available to OA admins
and app admins only.

---

## On the trailing slash

Partly right, but not as framed. Verification normalizes to a **directory prefix**, and
sub-paths inherit (`huong-dan-xac-thuc-domain`):

> *"Khi bạn xác thực với một URL (ví dụ: https://example.com/party/) thì Zalo Platform
> nhận định các URL có path con ... đã được xác thực mà không cần có xác thực."*

We verified `.../callback/`, which covers `.../callback/anything` — but `.../callback` is
its **parent**, not a child, so that entry does not cover it. The bare-domain verification
should, so this alone was probably not fatal. Once the console field exists, make it
byte-identical to what we send.

Also documented there, and useful later: query strings and file extensions are **stripped**
before comparison (so `?code=&state=` is safe), max 20 domains + 20 URLs per app, 75-char
limit per entry, and **tunnel hosts skip verification entirely** — `localtunnel.me`,
`ngrok.io`, `localhost.run`, `serveo.net`. That last one is the answer to local development.

---

## Hypotheses, resolved

| # | Original hypothesis | Verdict |
|---|---|---|
| 1 | Trailing-slash mismatch | Contributing at most; not the cause |
| 2 | Separate allowlist under Login → Add Platform → Web | **Wrong screen** — that is Social API only. Right idea, wrong location |
| 3 | Domain auth proves ownership only, is not the allowlist | ✅ **Correct** |
| 4 | App needs a Web platform declared | Not required per docs; untested fallback if the fix does not take |

---

## The `-14xxx` family

`oauth.zaloapp.com` has its own error family, **not published in any Zalo error table**.
Only two codes are attested anywhere:

| Code | `error_name` | Meaning |
|---|---|---|
| `-14002` | `Invalid appId` | `error_reason: "App is not active but user is not admin"` |
| `-14003` | `Invalid redirect uri` | `error_reason` is **empty** |

Both are now in `zalo-errors.json` under `surface: "oauth"`, flagged `needs_human`.

**Log the entire error body.** `error_reason` is empty on `-14003` and `error_name` is the
only real signal. One quirk to ignore: the `ref_doc` link returned with `-14003` points at
the **Social API** docs even for the OA endpoint — evidence that `oauth.zaloapp.com`
validates redirect URIs in one shared layer, and a good way to get sent to the wrong
console screen.

---

## Spec corrections

`docs/ZALO_API.md` §4.1 described the OA flow as a hand-built authorize URL — that was
wrong and this issue is downstream of it. Now corrected:

- **§4.1** rewritten: console-configured flow, one fixed PKCE pair, verbatim Vietnamese sources
- **§4.1.1** prerequisite chain with the error for each missing link
- **§4.1.2** the `-14xxx` family
- **§4.1.3** the API Explorer shortcut
- **§2** new invariant #9 covering console-registration
- **§22** provisioning checklist extended with the console steps
- **§23** items 29–31 for what remains unverified
- `ZALO_RULES.md` / `CLAUDE.md` gained an "OA console setup" table
- `zalo-errors.json` gained the `oauth` surface
