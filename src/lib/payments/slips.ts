import { supabase } from "@/lib/supabase/client";
import { downscaleImage } from "@/lib/images/downscale";

/**
 * Photographs of card slips.
 *
 * A PRIVATE bucket, unlike menu photography. A slip carries the masked card
 * number, the merchant id and the approval code — none of it catastrophic on
 * its own, and none of it something to serve from a public URL that anyone
 * who guesses a path can read. Access is a short-lived signed URL, and only
 * for a signed-in device.
 *
 * The photo is the reconciliation record: at cash-up the terminal's own
 * settlement is matched against these, and a picture of the slip beats a
 * typed approval code because it cannot be mistyped and it shows the amount.
 */

const BUCKET = "payment-slips";

/** Long enough to look at, not long enough to pass around. */
const SIGNED_URL_TTL_SECONDS = 300;

/** Legible enough to read an approval code off, small enough to send fast. */
const MAX_EDGE_PX = 1400;

export type SlipUploadResult =
  | { ok: true; path: string }
  | { ok: false; reason: "not_configured" | "not_an_image" | "failed"; detail?: string };

export async function uploadCardSlip(paymentId: string, file: File): Promise<SlipUploadResult> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  if (!file.type.startsWith("image/")) return { ok: false, reason: "not_an_image" };

  // Higher quality than a menu tile: this exists to be read, not admired.
  const body = await downscaleImage(file, MAX_EDGE_PX, 0.88);
  const path = `${paymentId}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    // Overwrites, so a waiter who took a blurry one can simply retake it.
    .upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) return { ok: false, reason: "failed", detail: error.message };

  return { ok: true, path };
}

/** A short-lived URL for looking at a slip. Null when it cannot be reached. */
export async function cardSlipUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
