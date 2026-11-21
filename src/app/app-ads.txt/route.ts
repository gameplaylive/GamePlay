import { NextResponse } from "next/server";
import { getAppSettingsFull } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Serves /app-ads.txt for AdMob app-ads.txt crawlers (Android store listing domain).
 */
export async function GET() {
  const settings = await getAppSettingsFull();
  const adsenseRaw =
    settings.adsense_publisher_id?.trim() ||
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ||
    "ca-pub-5165582915599822";
  // AdMob app id is ca-app-pub-########~… — authorize that publisher too.
  const admobApp = settings.admob_app_id?.trim() || "";
  const admobPubMatch = admobApp.match(/ca-app-pub-(\d+)/i);

  const pubs = new Set<string>();
  const adsensePub = adsenseRaw.replace(/^ca-/i, "");
  if (adsensePub.startsWith("pub-") && !adsensePub.includes("0000000000000000")) {
    pubs.add(adsensePub);
  }
  if (admobPubMatch) pubs.add(`pub-${admobPubMatch[1]}`);
  if (!pubs.size) pubs.add("pub-5165582915599822");

  const lines: string[] = [
    "# GamePlay Live — Google AdMob app-ads.txt",
    "# Host this on the developer website listed in Play Console",
  ];
  for (const pub of pubs) {
    lines.push(`google.com, ${pub}, DIRECT, f08c47fec0942fa0`);
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
