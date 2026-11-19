import type { Config } from "@netlify/functions";

/** Favorite creator live + recent VODs — YouTube & Twitch every 10m. */
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    return new Response("missing URL or CRON_SECRET", { status: 500 });
  }

  const res = await fetch(
    `${base.replace(/\/$/, "")}/api/cron/check-favorite-live?platform=all`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    }
  );
  const text = await res.text();
  console.log("cron-check-favorites", res.status, text.slice(0, 400));
  return new Response(text, { status: res.status });
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
