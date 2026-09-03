# 9Pay POS card terminal

Source: <https://developers.9pay.vn/pos/api-tao-giao-dich-tren-pos-cho-dai-ly>
and <https://developers.9pay.vn/danh-sach-api/quy-tac-tich-hop>.

## What it buys us

Today a card payment happens on a machine the app knows nothing about: the
waiter rings up the amount separately, then types the approval number back
into VINPOS (or photographs the slip) so cash-up can be reconciled by hand.
With 9Pay the till pushes the amount to the terminal, the guest taps, and
the bill settles itself. Fewer keystrokes at the table, and no possibility
of a typo between the terminal and the bill.

## How it flows

1. Waiter taps **Card → Charge on the terminal**.
2. `POST /api/payments/ninepay/create` (server-side, so the signing key is
   never on a device) signs and forwards the charge to 9Pay with our payment
   reference as `request_id`.
3. Only if 9Pay accepts does the till record a `card` payment as **pending**.
   A rejected charge leaves nothing half-recorded.
4. Guest taps their card. 9Pay POSTs the IPN to
   `/api/payments/ninepay/ipn?branch=<tenant>`.
5. The IPN is verified, then recorded in `payment_webhook_events` — the same
   table bank transfers land in. Nothing is settled server-side.
6. The till's existing pending-payment poll sees its own reference come back
   and confirms the payment into local storage, which syncs out.

Steps 5–6 are deliberately the bank-transfer path. There is exactly one way
money becomes "paid" in this app, and adding a second would be adding a
second place for it to go missing.

## The two crypto schemes (`src/lib/payments/ninepay.ts`, 16 tests)

**Outbound** — every call carries:

```
Authorization: Signature Algorithm=HS256,Credential=<merchantKey>,SignedHeaders=,Signature=<sig>
Date: <unix timestamp, 10 digits>
```

where `sig = base64(HMAC_SHA256(METHOD + "\n" + URI + "\n" + timestamp + "\n" + params, secretKey))`
and `params` is `name=value` pairs joined with `&`.

**Inbound (IPN)** — form-encoded `result`, `checksum`, `version`:

```
checksum == UPPERCASE(sha256(result + checksumKey))     # plain hash, NOT hmac
data      = JSON.parse(base64_decode(result))
```

Note the checksum key is a *different* key from the signing secret, and the
IPN scheme is a plain hash rather than an HMAC. That is 9Pay's design; ours
is to verify in constant time and fail closed.

Statuses: `2` processing · `5` success · `6` failed · `8` cancelled ·
`10` refunded · `17` pending settlement. Only **5** and **17** settle a bill
(17 is captured-but-not-paid-out, which is paid as far as the guest is
concerned). The IPN is documented to fire only on success; we check the
status anyway, because "we only send success" is a promise about someone
else's code and this endpoint closes bills.

## ⚠️ Confirm before going live

9Pay's rules page states the signed parameters are ordered **alphabetically**,
but the worked example on that same page is in a different order
(`merchantKey`, `invoice_no`, `amount`, `description`, `return_url`). Both
cannot be right, and a wrong string-to-sign fails with an opaque error.

`canonicalizeParams()` implements the *stated rule* and is the single seam,
with tests. Against sandbox, confirm:

1. Alphabetical, or the example's order?
2. Is `merchantKey` itself one of the signed params? (The example includes it;
   our create call does not.)
3. Are values URL-encoded before signing, or raw? (We sign raw — encoding on
   one side only is the classic cause of a correct-looking rejected signature.)
4. The real POS host. `DEFAULT_ENDPOINT` is 9Pay's sandbox; production is set
   per branch in `branch_secrets.ninepay_endpoint`.

## Setting a branch up

1. Run `supabase/ninepay-schema.sql` once (adds the key columns to
   `branch_secrets` and relaxes `webhook_secret` to nullable, since a branch
   may now have terminal keys and no bank webhook).
2. Insert that branch's `ninepay_merchant_key`, `ninepay_secret_key`,
   `ninepay_checksum_key`, `ninepay_serial` (the terminal's S/N) and
   `ninepay_endpoint` — service role only; these never reach a device.
3. Register the IPN URL with 9Pay:
   `https://<host>/api/payments/ninepay/ipn?branch=<tenant-id>`.
4. Turn on **Card terminal (9Pay)** in the branch's payment settings; the
   button stays hidden until then, and the switch ships off.
