import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push/server";

/**
 * The daily sweep — the one deliberate exception to "no cron".
 *
 * The app's rule is that alerts ride on the action that produced them, and
 * that rule holds everywhere an action exists. This route exists for the
 * failures whose defining feature is that no action ever happens: a print
 * bridge that died overnight cannot announce itself, and a ticket that never
 * printed has nobody left to notice it. Someone has to look; this looks once
 * a day.
 *
 * It only sweeps what Postgres can see. Licences, health certificates and
 * the rest of the compliance calendar are local-first collections that never
 * reach a server — their reminders ride on app-open, as designed.
 *
 * Vercel calls this on the schedule in vercel.json with
 * "Authorization: Bearer $CRON_SECRET"; anyone else is a 401.
 */

export const dynamic = "force-dynamic";

type Sweep = {
  expiredJobs: number;
  deadBridges: string[];
  supportLapsing: { orgId: string; name: string; supportUntil: string }[];
  pushed: number;
};

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = service();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const result: Sweep = { expiredJobs: 0, deadBridges: [], supportLapsing: [], pushed: 0 };

  // 1. Tickets that will never print. The bridge fails jobs older than 15
  //    minutes when it is RUNNING; a dead bridge leaves them queued forever,
  //    which would keep the settings page shouting about last week. A day-old
  //    queued job is declared failed so the queue reflects reality.
  const { data: expired } = await db
    .from("print_jobs")
    .update({ status: "failed", error: "expired unprinted — bridge never claimed it" })
    .eq("status", "queued")
    .lt("created_at", iso(24 * 3600_000))
    .select("id, tenant_id");
  result.expiredJobs = expired?.length ?? 0;

  // 2. Bridges that stopped beating at a branch that prints. Only branches
  //    with a heartbeat row are checked — a branch that never set printing up
  //    has nothing to be warned about.
  const { data: bridges } = await db
    .from("print_bridge_status")
    .select("tenant_id, seen_at")
    .lt("seen_at", iso(2 * 3600_000));
  for (const bridge of bridges ?? []) {
    const { count } = await db
      .from("print_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", bridge.tenant_id)
      .gt("created_at", iso(7 * 24 * 3600_000));
    if ((count ?? 0) === 0) continue; // printing not actually in use
    result.deadBridges.push(bridge.tenant_id);
    const summary = await sendPush(
      {
        category: "issues",
        title: "Print bridge is down",
        body: "Máy chủ in đã dừng — kiểm tra máy chạy bridge. Tickets will queue, not print.",
        url: "/settings/printing",
        tag: "bridge-down",
        urgent: true,
      },
      bridge.tenant_id
    );
    result.pushed += summary.sent;
  }

  // 3. Support periods about to lapse — surfaced for the platform's own
  //    morning read (the cron log and the admin console), never pushed to the
  //    customer's staff. Free means never switched off for money; this is a
  //    reminder to a human to have a conversation.
  const soon = new Date(now + 7 * 24 * 3600_000).toISOString().slice(0, 10);
  const { data: lapsing } = await db
    .from("org_billing")
    .select("org_id, support_until, organizations(name)")
    .not("support_until", "is", null)
    .lte("support_until", soon);
  for (const row of lapsing ?? []) {
    const org = row.organizations as unknown as { name?: string } | null;
    result.supportLapsing.push({
      orgId: row.org_id as string,
      name: org?.name ?? row.org_id,
      supportUntil: row.support_until as string,
    });
  }

  return NextResponse.json(result);
}
