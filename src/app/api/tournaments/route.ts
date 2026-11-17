import { NextResponse } from "next/server";
import { getUnifiedTournaments } from "@/lib/fetch-tournaments";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getUnifiedTournaments();
  return NextResponse.json(payload);
}
