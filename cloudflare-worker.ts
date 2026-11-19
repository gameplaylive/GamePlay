// @ts-expect-error `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

type CronEnv = {
  CRON_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
  APP_URL?: string;
};

type ScheduledControllerLike = {
  cron: string;
  scheduledTime: number;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

/**
 * Cron expressions must match wrangler.jsonc `triggers.crons` exactly
 * (`controller.cron` is compared character-for-character).
 */
const CRON_PATHS: Record<string, string[]> = {
  "*/20 * * * *": ["/api/sync-streams?platform=youtube"],
  "*/3 * * * *": ["/api/sync-streams?platform=twitch"],
  "0 */6 * * *": ["/api/sync-trending"],
  "*/10 * * * *": [
    "/api/cron/check-favorite-live?platform=all",
    "/api/cron/process-reminders",
  ],
  // Hourly: morning/evening/night digests by each device's local timezone
  "5 * * * *": ["/api/cron/push-digest"],
};

function appBase(env: CronEnv): string {
  const fromEnv = env.NEXT_PUBLIC_APP_URL || env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://gameplaylive.live";
}

async function runCron(path: string, env: CronEnv): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error("cron: missing CRON_SECRET");
    return;
  }
  const url = `${appBase(env)}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const text = await res.text();
  console.log("cron", path, res.status, text.slice(0, 400));
}

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledControllerLike,
    env: CronEnv,
    ctx: ExecutionContextLike
  ) {
    const paths = CRON_PATHS[controller.cron];
    if (!paths?.length) {
      console.error("cron: unknown schedule", controller.cron);
      return;
    }
    ctx.waitUntil(
      (async () => {
        for (const path of paths) {
          await runCron(path, env);
        }
      })()
    );
  },
};
