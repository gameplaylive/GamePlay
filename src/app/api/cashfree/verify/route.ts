import { NextResponse } from "next/server";

/** Creator Pro / Cashfree verify disabled — app is free for all users at launch. */
export async function POST() {
  return NextResponse.json(
    { error: "Subscriptions are disabled. GamePlay Live is free for all signed-in users.", code: "FREE_LAUNCH" },
    { status: 410 }
  );
}

export async function GET() {
  return POST();
}
