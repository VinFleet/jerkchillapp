import { NextResponse } from "next/server";
import { getOaStatus } from "@/lib/zalo/oa";

/**
 * What the Official Account can currently do, read from Zalo rather than
 * guessed from configuration.
 */

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getOaStatus());
}
