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
    "ca-pub-5165582915599822";

  // Google ads.txt requires pub-XXXX (script tag uses ca-pub-XXXX)
  const pub = raw.replace(/^ca-/i, "");
  const lines: string[] = [
    "# GamePlay Live — Google AdSense authorized sellers",
    "# https://gameplaylive.live/ads.txt",
  ];

  if (pub.startsWith("pub-") && !pub.includes("0000000000000000")) {
    lines.push(`google.com, ${pub}, DIRECT, f08c47fec0942fa0`);
  } else {
    lines.push("google.com, pub-5165582915599822, DIRECT, f08c47fec0942fa0");
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
