import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

/** Public liveness check for the deploy script and the phone. No secrets, no user data. */
export async function GET() {
  const health = await checkHealth(getDb);
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
