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

- [ ] Go to `/bookings` in the app, sign in with the staff login you
      created, and confirm the page loads (no "not connected" message).
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
