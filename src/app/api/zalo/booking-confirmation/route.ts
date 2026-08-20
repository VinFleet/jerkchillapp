import { NextResponse } from "next/server";
import { sendBookingConfirmation } from "@/lib/zalo/zns";
import { zaloIsConfigured } from "@/lib/zalo/config";

/**
 * Sends a guest their booking confirmation over Zalo.
 *
 * This lives on the server for one reason: the Zalo app secret. Anyone holding
 * it can send messages as the restaurant, so it never reaches the browser —
 * the booking page calls this route, and this route talks to Zalo.
 *
 * Returns 200 for every expected outcome, including "not configured" and
 * "invalid phone number". A confirmation is a courtesy on top of the booking;
 * the booking is already saved by the time this runs, and a failure here must
 * not present to the guest as a failed booking.
 */

export const runtime = "nodejs";

type Body = {
  phone?: string;
  guestName?: string;
  bookingTime?: string;
  partySize?: number;
  bookingRef?: string;
};

export async function POST(request: Request) {
  if (!zaloIsConfigured()) {
    return NextResponse.json({ status: "skipped", reason: "not_configured" });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ status: "failed", message: "Body was not JSON" }, { status: 400 });
  }

  const { phone, guestName, bookingTime, partySize, bookingRef } = body;
  if (!phone || !guestName || !bookingTime || !bookingRef || typeof partySize !== "number") {
    return NextResponse.json(
      { status: "failed", message: "Missing booking details" },
      { status: 400 }
    );
  }

  const result = await sendBookingConfirmation({
    phone,
    guestName,
    bookingTime,
    partySize,
    bookingRef,
  });

  // The result carries its own status; the transport succeeded either way.
  return NextResponse.json(result);
}
