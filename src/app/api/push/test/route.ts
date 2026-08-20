import { NextResponse } from "next/server";
import { sendPushToEndpoint } from "@/lib/push/server";

/**
 * "Send me a test" — the button on the notifications screen.
 *
 * Worth having its own route: staff need to see an alert actually arrive on
 * their own phone before they'll trust that the app will reach them. Without
 * proof, the first real alert is also the first test.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  let endpoint: string | undefined;
  try {
    endpoint = ((await request.json()) as { endpoint?: string }).endpoint;
  } catch {
    return NextResponse.json({ error: "Body was not JSON" }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const ok = await sendPushToEndpoint(endpoint, {
    title: "Test alert · Thông báo thử",
    body: "Notifications are working on this phone. · Thông báo hoạt động trên máy này.",
    url: "/settings/notifications",
    tag: "jc-test",
  });

  return NextResponse.json({ status: ok ? "sent" : "failed" });
}
