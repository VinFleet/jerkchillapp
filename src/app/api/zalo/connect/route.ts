import { NextResponse } from "next/server";
import { getZaloConfig } from "@/lib/zalo/config";

/**
 * Sends the owner to Zalo's consent screen.
 *
 * This route used to BUILD the authorize URL from parts, which is how every
 * other OAuth provider works and is exactly why it returned -14003 forever.
 * Zalo's OA flow is console-configured: the callback URL and code challenge are
 * saved settings at Sản phẩm → Official Account → Thiết lập chung, and Zalo
 * *generates* the consent link from them. `/v4/oa/permission` appears nowhere in
 * Zalo's OA documentation — it isn't documented because you aren't meant to
 * construct it.
 *
 * So the link is configuration, not something we assemble.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cfg = getZaloConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Zalo isn't configured — add ZALO_APP_ID and ZALO_APP_SECRET first." },
      { status: 400 }
    );
  }

  const consentUrl = process.env.ZALO_CONSENT_URL;
  if (!consentUrl) {
    // Deliberately explicit rather than falling back to a hand-built URL: that
    // fallback is precisely the bug, and it fails with an error that says
    // nothing useful.
    const back = new URL("/settings/zalo", request.url);
    back.searchParams.set("connected", "0");
    back.searchParams.set("reason", "no_consent_url");
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(consentUrl);
}
