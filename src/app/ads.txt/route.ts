import { NextResponse } from "next/server";
import { getAppSettingsFull } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Serves /ads.txt for AdSense crawlers.
 * Uses Admin vault publisher id or NEXT_PUBLIC_ADSENSE_CLIENT_ID (ca-pub-…).
 */
export async function GET() {
  const settings = await getAppSettingsFull();
  const raw =
    settings.adsense_publisher_id?.trim() ||
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ||
    "";

  const pub = raw.replace(/^ca-/i, ""); // ads.txt wants pub-XXXX not ca-pub-XXXX
  const lines: string[] = [
    "# GamePlay Live — Google AdSense authorized sellers",
    "# https://gameplaylive.live/ads.txt",
  ];

  if (pub.startsWith("pub-") && !pub.includes("0000000000000000")) {
    lines.push(`google.com, ${pub}, DIRECT, f08c47fec0942fa0`);
  } else {
    lines.push(
      "# Pending: set adsense_publisher_id (ca-pub-…) in Admin vault or NEXT_PUBLIC_ADSENSE_CLIENT_ID"
    );
    lines.push("# Example: google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0");
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
