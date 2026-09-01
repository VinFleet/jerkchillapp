# Print bridge · Cầu in

Makes "tap Save → the ticket prints in the kitchen" work, like Sapo.

A web app cannot talk to a printer's IP the way a native app can — browsers
have no raw sockets, and an HTTPS page may not call `http://192.168.x.x`. So
the app writes print jobs to a queue, and this small program — running on any
machine in the restaurant that stays on — prints them to the LAN printers.

## One-time setup (10 minutes)

1. Pick the machine. Anything on the restaurant wifi that stays powered:
   the office laptop, a mini PC, a Raspberry Pi. It needs Node 20+.

2. Find each printer's IP. Print the printer's self-test page (hold the feed
   button while powering on — most thermal printers), it lists the IP.
   Give the printers fixed IPs in the router so they never move.

3. Create `printers.json` in this folder:

   ```json
   {
     "kitchen": { "host": "192.168.1.50", "width": 42 },
     "receipt": { "host": "192.168.1.51", "width": 42 }
   }
   ```

   `width` is characters per line: 42 or 48 for 80mm paper, 32 for 58mm.
   One physical printer for both jobs? Point both names at the same host.

4. Run it (values from `.env.local`):

   ```bash
   SUPABASE_URL=https://hvcfobhvhqmhgdvivkle.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
   node tools/print-bridge/bridge.mjs
   ```

   You should see `print bridge up`. Order something; the ticket prints.

5. Keep it alive across reboots — macOS example with `launchd`, or on any
   machine just add it to startup. `pm2 start bridge.mjs` also works if you
   have pm2.

## Behaviour worth knowing

- **Internet down = no auto-print.** The queue lives in Supabase. The
  on-screen Print buttons still work from any device on the tickets and
  bills screens — that is the fallback, same as before the bridge existed.
- **Old jobs are skipped, not replayed.** A bridge switched on after lunch
  marks anything older than 15 minutes failed instead of printing the whole
  morning onto the pass.
- **Two bridges are safe.** Jobs are claimed by compare-and-swap; a ticket
  prints once.
- **Vietnamese prints without diacritics** (`Ga Jerk`, `Nuoc Ngot`). Cheap
  printers disagree about Vietnamese codepages, and readable-plain beats
  mojibake. The screen keeps full diacritics.

Requires `supabase/print-jobs-schema.sql` to have been run once.
