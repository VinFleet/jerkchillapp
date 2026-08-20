# Jerk & Chill Ops — Setup & Go-Live Checklist

This is the running checklist for taking the app from "working on my laptop"
to "live, with online booking connected to a real website." Nothing here is
time-sensitive — work through it whenever you're ready, in order. Check
items off as you go (`- [ ]` → `- [x]`) so it's obvious where you left off.

Everything in the app **except the booking system** is local-first (it lives
in the browser, no server needed) and already works today. The booking
system is the one piece that needs a real backend, because a customer's
phone and the restaurant's tablet have to see the same live data.

---

## Part 1 — Supabase (the booking database)

This is the only backend the app needs. Free tier is enough for a single
restaurant.

- [ ] Create a free account/project at [supabase.com](https://supabase.com)
- [ ] Open **SQL Editor → New query**, paste the entire contents of
      [`supabase/schema.sql`](supabase/schema.sql), and run it.
      (Safe to re-run any time — every statement is idempotent.)
- [ ] Open **SQL Editor → New query** again, paste the contents of
      [`supabase/sync-schema.sql`](supabase/sync-schema.sql), and run it.
      This is what makes the tablets share data with each other.
      **✅ Already done — 20 Aug 2026.**
- [ ] Go to **Authentication → Users → Add user** and create **TWO**
      logins (email + password each). Write both down somewhere safe (a
      password manager, not a sticky note):
  - **A station login**, e.g. `station@jerkandchill.vn` — this is what
    the kitchen tablet and the bar tablet sign into. Not per-person: it
    just proves "this device is the restaurant." Staff enter it once,
    when the tablet is set up, and never again.
  - **Your own owner login**, e.g. your real email — this is the only
    one that can open the Manager / Owner station, where wages and cost
    margins live.
- [ ] Give your owner login the owner role. In **SQL Editor**, run:
      ```sql
      insert into staff_roles (user_id, role, full_name)
      select id, 'owner', 'Manny' from auth.users
      where email = 'your-owner-email@example.com'
      on conflict (user_id) do update set role = 'owner';
      ```
      Replace the email with your real one. **Do not do this for the
      station login** — that's exactly what stops the shared tablet from
      reaching wages and costs.
- [ ] Go to **Project Settings → API** and copy two values:
  - **Project URL**
  - **anon public** key (NOT the `service_role` key — never use that one
    in this app, it bypasses all the security rules)
- [ ] Copy [`.env.local.example`](.env.local.example) to `.env.local` in
      the project root and paste those two values in.
- [ ] Restart the dev server (`npm run dev`) so it picks up the new
      `.env.local`.

## Part 2 — Test it locally

- [ ] Open the app. On the "Where are you working?" screen, tap **Kitchen**
      and enter the **station login** — this is the one-time device setup.
      You should land on the home screen and be asked to pick a name.
- [ ] Check the sync indicator in the header reads **"Up to date"** and not
      the red **"Not shared"**. Red means the device has no session and is
      recording only to itself.
- [ ] Tap **Log out**, then choose **Manager / Owner** and sign in with your
      **owner** login. If it says the account has no role assigned, the
      `staff_roles` step above hasn't run — it shows you the exact SQL.
- [ ] Go to `/bookings` and confirm the page loads (no "not connected"
      message, and no second login prompt — the station session covers it).
- [ ] Under "Manage tables," add your real tables — table number + seat
      count for each. (This only needs doing once.)
- [ ] Go to `/book` (the public page, no login) in a **different browser
      or incognito window** and submit a test booking.
- [ ] Confirm the test booking appears on the `/bookings` tablet view
      within a couple of seconds, with no page refresh (this is Supabase
      Realtime — proves the live connection works end to end).
- [ ] Delete the test booking (or mark it cancelled) once confirmed.

## Part 3 — GitHub

- [ ] Create a new (private, recommended) GitHub repository — don't
      initialize it with a README, since this project already has files.
- [ ] Tell Claude the repo URL and it will push the current code to it.
- [ ] Confirm `.env.local` is **not** in the repo (it's already in
      `.gitignore` — just double-check on GitHub that you don't see it,
      since it holds your Supabase keys).

## Part 4 — Vercel

- [ ] Create a free account at [vercel.com](https://vercel.com) if you
      don't have one (sign in with GitHub — simplest).
- [ ] **Add New Project → Import** the GitHub repo from Part 3. Vercel
      auto-detects this as a Next.js app — no config needed.
- [ ] Before the first deploy, add the environment variables (**Project
      Settings → Environment Variables**):
  - `NEXT_PUBLIC_SUPABASE_URL` = same value as in `.env.local`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = same value as in `.env.local`
- [ ] Deploy. Vercel gives you a URL like `jerk-and-chill.vercel.app`.
- [ ] Every future `git push` to the main branch auto-deploys — you won't
      need to repeat this step.

## Part 5 — Going live

- [ ] Open the Vercel URL on the kitchen tablet, sign in with staff role
      + the Supabase login, and **install it as an app** (Add to Home
      Screen / Install App in the browser menu) — this is what makes it
      feel native, per the PWA setup already built in.
- [ ] Share the `/book` link (e.g. `jerk-and-chill.vercel.app/book`)
      anywhere customers can find it — Instagram bio, Google Business
      Profile, a QR code on the table or at the door. You don't need a
      full website for this to work.
- [ ] Optional: buy a custom domain and point it at the Vercel project
      (**Project Settings → Domains**) so the link reads nicer, e.g.
      `book.jerkandchill.com`.
- [ ] When (if) you build a real website later, just link its "Book a
      Table" button to the same `/book` URL — no extra integration work
      needed, it was built for exactly this.

## Ongoing notes

- **Free tier limits**: Supabase's free tier is generous for a
  single-location restaurant (500MB database, 50k monthly active users) —
  you won't hit it. Vercel's free (Hobby) tier is also fine for this
  traffic level.
- **More staff logins**: if you want individual staff logins instead of
  one shared device login later, that's a real (bigger) change — ask
  when you're ready and we'll scope it.
- **Backups**: Supabase takes automatic daily backups on paid plans; on
  the free tier there's no automatic backup, so if the booking data
  becomes business-critical, that's worth budgeting for eventually.

---

## Part 6 — Zalo booking confirmations (optional, costs money)

**Skip this entirely if you don't want it.** Everything else works without it,
and the app behaves exactly as it does today until all four environment
variables below exist.

### What this does and doesn't do

Zalo will send a **guest** their booking confirmation. It will **not** carry the
restaurant's own reminders, for reasons that are Zalo's rules, not ours:

- **Nothing sends between 22:00 and 06:00 Vietnam time.** A hard platform ban.
  The closing checklist, the last fridge check and the end-of-day sales entry
  all happen inside that window.
- **You cannot message someone who hasn't contacted your OA in the last 7 days.**
  Staff won't do that reliably.
- **There is no API for posting into a group chat.** The staff Zalo group can't
  be written to programmatically.

For internal messages, use the **Share** buttons already in the app — they drop
the rota, order list or notice straight into whichever Zalo chat you pick, free,
at any hour.

### Before you can turn it on

- [ ] An **Official Account** at [oa.zalo.me](https://oa.zalo.me), **verified**.
      Unverified accounts cannot send ZNS at all.
- [ ] A **Zalo Cloud Account** at [zalo.cloud](https://zalo.cloud), linked and
      funded. Without it every send fails with `-136` / `-137`.
- [ ] A **Zalo App** at [developers.zalo.me](https://developers.zalo.me), linked
      to the OA. Gives you the App ID and secret.
- [ ] A **message template** submitted and approved by Zalo. Review takes days,
      so do this early. It needs three parameters named `customer`, `time`
      and `guests`.
- [ ] Ask Zalo about their rule that personal data be **processed on servers in
      Vietnam**. Vercel is not in Vietnam. We don't know how strictly this is
      enforced for a small restaurant, but it is their written policy and it is
      better to ask before paying.

Rough cost: Zalo's own sample template lists ~800đ per message. At ten bookings
a day that is on the order of 240,000đ/month — but confirm your real price,
since it varies by template.

### Turning it on

- [ ] Run [`supabase/zalo-schema.sql`](supabase/zalo-schema.sql) in the Supabase
      SQL editor. Creates the token table, locked so only the server can read it.
- [ ] In Vercel, add these environment variables (**Project Settings →
      Environment Variables**). None of them start with `NEXT_PUBLIC_`, which is
      what keeps them out of the browser:

  ```
  ZALO_APP_ID
  ZALO_APP_SECRET
  ZALO_OA_ID
  ZALO_BOOKING_TEMPLATE_ID
  SUPABASE_SERVICE_ROLE_KEY     # Supabase → Project Settings → API
  ```

- [ ] Set `ZALO_DEVELOPMENT_MODE=true` for the first test. In development mode
      Zalo only delivers to OA administrators, so you can prove the whole path
      without messaging a real guest. Remove it when you're happy.
- [ ] Make a test booking on `/book` using **your own** phone number and confirm
      the Zalo message arrives.
- [ ] Set `ZALO_DEVELOPMENT_MODE=false` (or delete it) to go live.

### If it stops working

The most likely cause is money: `-137` means the Zalo Cloud Account can't be
charged. `-135` means the OA lost its verification or paid plan. `-133` means
you tried to send at night. Nothing here can break a booking — confirmations are
sent after the booking is already saved, and a failure is logged, not shown to
the guest.

---

## Part 7 — Alerts on staff phones (free, recommended)

This is the one that makes the app reach people. An alert lands on the phone
even when the app is closed — an order ready to send, a fridge out of range, a
booking cancelled. **Free, no per-message cost, and unlike Zalo it works after
22:00**, which is when the closing checklist and the last fridge check happen.

Each person chooses what they want to hear about, on their own phone, under
**More → Alerts**. Nobody gets alerts about things that aren't their job — which
is what stops people muting the app entirely.

### Generate the keys (once)

In a terminal, in the project folder:

```bash
npx web-push generate-vapid-keys
```

That prints a public key and a private key. They identify this app to the
browsers' push services — generate them once and keep them; changing them later
unsubscribes every device.

### Add them

- [ ] Run [`supabase/push-schema.sql`](supabase/push-schema.sql) in the Supabase
      SQL editor.
- [ ] Add these to `.env.local` (and to Vercel → Project Settings →
      Environment Variables):

  ```
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # the public key — safe in the browser
  VAPID_PRIVATE_KEY=              # the private key — server only, never NEXT_PUBLIC_
  VAPID_SUBJECT=mailto:you@example.com
  SUPABASE_SERVICE_ROLE_KEY=      # Supabase → Project Settings → API
  ```

- [ ] Redeploy, then open **More → Alerts** and tap **Turn on**, then
      **Send me a test**. The test alert should appear on that phone.

### Getting staff onto it

- [ ] Each person opens the app on their own phone, goes to **More → Alerts**,
      taps **Turn on**, and picks their categories.
- [ ] **On iPhone this only works if the app is installed** — Share → "Add to
      Home Screen", then open it from the Home Screen icon. Alerts do not work
      in the Safari tab. Android works either way.
- [ ] Ask them to actually tap **Send me a test**. People don't trust alerts
      they haven't seen arrive.

### Zalo group (optional, on top)

If you set up an OA-owned Zalo group (Part 8), the same alerts also post there,
so there's a record everyone can scroll back through. Web Push reaches the
person on shift; the group reaches the person who was off.

---

## Part 8 — Zalo staff group (optional, free to send)

Posts the same alerts into a Zalo group, so there's a record the whole team can
scroll back through.

### The catch, before you plan around it

**Your existing staff Zalo group cannot be used.** There is no "join this group
and post" API. The group has to be *created by your Official Account*, and then
people are invited into it. So this means moving the team to a new group — a
one-off, but it needs everyone to actually move.

Also, people can only be invited if they **already follow your OA** or have
messaged it in the last 7 days. You can't add someone by phone number.

### What it costs

Sending is **free** — no per-message charge, no send quota, no 7-day window.
What you buy is the *group*: a GMF package sized by member ceiling
(`gmf10` / `gmf50` / `gmf100` / `gmf1000`). For seven staff, `gmf10` is enough.

⚠️ **The group is deleted when the package expires.** Zalo ties an
`auto_delete_date` to it. Put that date in the Licensing & Compliance calendar
alongside your other renewals, or the team's group disappears without warning.

### Setup

- [ ] OA must be **verified** and on the **Advanced or Premium** tier — the
      lower tiers can't do group messaging at all.
- [ ] Buy a **GMF package** (`gmf10` covers up to 10 members).
- [ ] Get every staff member to **follow the restaurant's OA** on Zalo. Nobody
      can be added to the group until they have.
- [ ] Create the group through the OA, invite the team, and note its group id.
- [ ] Add to Vercel:

  ```
  ZALO_GROUP_ID=
  ```

  (This needs the Zalo credentials from Part 6 as well — same OA, same token.)

### Still to confirm

- [ ] **Does the 22:00–06:00 send ban apply to group messages?** It applies to
      OA messages and to ZNS. Group messages go through an OA endpoint, so it
      probably does — but we haven't confirmed it. **Test it**: send an alert at
      23:00 and see whether it arrives. If it's banned, Web Push (Part 7) is
      your only after-hours channel, which is the main reason to set that up
      first.
