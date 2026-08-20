import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push/server";
import { isPushCategory } from "@/lib/push/categories";
import { sendGroupMessage } from "@/lib/zalo/group";

/**
 * Fan an alert out to everyone who asked for that category.
 *
 * Called by the device that caused the event — someone logs a complaint, saves
 * a booking change, finalises an order — and that device is excluded from the
 * fan-out, because the person who just did the thing doesn't need telling.
 *
 * There is no cron here on purpose. The app is local-first and has no
 * background worker; alerts ride on the action that produced them, which also
 * means they arrive immediately rather than on the next sweep.
 */

export const runtime = "nodejs";

type Body = {
  category?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
  excludeEndpoint?: string;
};

export async function POST(request: Request) {
  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body was not JSON" }, { status: 400 });
  }

  const { category, title, body, url, tag, urgent, excludeEndpoint } = payload;
  if (!category || !isPushCategory(category) || !title || !body) {
    return NextResponse.json({ error: "Missing category, title or body" }, { status: 400 });
  }

  // Two channels, deliberately. Web Push reaches the phone in someone's pocket
  // instantly and free; the Zalo group is where the team already looks and
  // leaves a record everyone can scroll back through. Neither is a fallback for
  // the other — a person on a day off reads the group, a person on shift feels
  // the phone.
  const [pushed, grouped] = await Promise.all([
    sendPush({ category, title, body, url, tag, urgent, excludeEndpoint }),
    // `untrustedBody` is escaped inside sendGroupMessage: this text can contain
    // a guest's own words, and mentions are a string convention rather than a
    // structured field.
    sendGroupMessage({ headline: title, untrustedBody: body, mentionEveryone: urgent === true }),
  ]);

  return NextResponse.json({ push: pushed, zaloGroup: grouped });
}
