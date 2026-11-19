import { NextResponse } from "next/server";

/** Creator Pro / Cashfree webhooks disabled — app is free for all users at launch. */
export async function POST() {
  return NextResponse.json({ ok: true, ignored: true, reason: "FREE_LAUNCH" });
}
