/**
 * Sending things out to Zalo.
 *
 * The restaurant runs its communication on Zalo, not email. The native share
 * sheet already has Zalo in it on any phone with the app installed, so this
 * needs no Official Account, no template approval, no per-message cost and no
 * server — a manager taps share, picks the staff group, done.
 *
 * (Zalo's own ZNS API is the other route, for things that must reach a
 * specific phone number without anyone tapping — guest booking confirmations,
 * mainly. That needs an approved OA, pre-approved templates and a per-message
 * fee, so it's a separate decision rather than a default.)
 *
 * Falls back to the clipboard on desktop, where there's no share sheet.
 */

export type ShareResult = "shared" | "copied" | "failed";

export async function shareText(title: string, text: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      // A user backing out of the share sheet is not a failure — don't fall
      // through to the clipboard and claim something happened.
      if (err instanceof DOMException && err.name === "AbortError") return "failed";
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Bilingual confirmation for a share result, so the button can say what actually happened. */
export function shareResultMessage(result: ShareResult): string | null {
  if (result === "shared") return null; // the share sheet is its own feedback
  if (result === "copied") return "Copied — paste it into Zalo · Đã sao chép — dán vào Zalo";
  return "Couldn't share — try again · Không chia sẻ được — thử lại";
}
