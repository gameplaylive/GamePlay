import { NextResponse } from "next/server";
import { getAppSettingsFull } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Serves /app-ads.txt for AdMob app-ads.txt crawlers (Android store listing domain).
 */
export async function GET() {
  const settings = await getAppSettingsFull();
  const raw =
    settings.adsense_publisher_id?.trim() ||
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ||
    "";
  const pub = raw.replace(/^ca-/i, "");

  const lines: string[] = [
    "# GamePlay Live — Google AdMob app-ads.txt",
    "# Host this on the developer website listed in Play Console",
  ];

  if (pub.startsWith("pub-") && !pub.includes("0000000000000000")) {
    lines.push(`google.com, ${pub}, DIRECT, f08c47fec0942fa0`);
  } else {
    lines.push(
      "# Pending: set the same Google publisher id used for AdMob (pub-…) once approved"
    );
  }

  lines.push("");

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
