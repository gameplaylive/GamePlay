import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function — YouTube live discovery every 20 minutes.
 * Hits the Next.js route so quota logic stays in one place.
 */
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base) {
    console.error("cron-sync-youtube: missing site URL");
    return new Response("missing URL", { status: 500 });
  }
  if (!secret) {
    console.error("cron-sync-youtube: missing CRON_SECRET");
    return new Response("missing CRON_SECRET", { status: 500 });
  }

  const res = await fetch(`${base.replace(/\/$/, "")}/api/sync-streams?platform=youtube`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  console.log("cron-sync-youtube", res.status, text.slice(0, 400));
  return new Response(text, { status: res.status });
};

export const config: Config = {
  schedule: "*/20 * * * *",
};
