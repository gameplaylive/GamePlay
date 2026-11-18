import type { Config } from "@netlify/functions";

/** Event reminder push fan-out every 10 minutes. */
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    return new Response("missing URL or CRON_SECRET", { status: 500 });
  }

  const res = await fetch(`${base.replace(/\/$/, "")}/api/cron/process-reminders`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  console.log("cron-process-reminders", res.status, text.slice(0, 400));
  return new Response(text, { status: res.status });
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
