import type { EventReminder, PulseCategoryBadge, PulseEvent, PulseEventType, TournamentMatch } from "@/lib/types";
import { countdownLabel, formatLocalStart } from "@/lib/tournaments";

export const SAMPLE_PULSE_EVENTS: PulseEvent[] = [
  {
    id: "pulse-yt-summer-game-fest",
    title: "Summer Game Fest — Live Showcase",
    game_name: "Multi",
    event_type: "game_show",
    badge: "GAME SHOW",
    start_time: new Date(Date.now() + 3 * 24 * 3600000).toISOString(),
    stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    status: "UPCOMING",
  },
  {
    id: "pulse-yt-nintendo-direct",
    title: "Nintendo Direct Mini Partner Showcase",
    game_name: "Nintendo",
    event_type: "game_show",
    badge: "GAME SHOW",
    start_time: new Date(Date.now() + 36 * 3600000).toISOString(),
    stream_url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    status: "UPCOMING",
  },
  {
    id: "pulse-yt-state-of-play",
    title: "PlayStation State of Play",
    game_name: "PlayStation",
    event_type: "game_show",
    badge: "GAME SHOW",
    start_time: new Date(Date.now() + 5 * 24 * 3600000).toISOString(),
    stream_url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    status: "UPCOMING",
  },
  {
    id: "pulse-yt-game-awards",
    title: "The Game Awards — Upcoming Premiere",
    game_name: "Multi",
    event_type: "gameplay",
    badge: "UPCOMING GAMEPLAY",
    start_time: new Date(Date.now() + 10 * 24 * 3600000).toISOString(),
    stream_url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
    status: "UPCOMING",
  },
];

export function badgeForType(type: PulseEventType): PulseCategoryBadge {
  if (type === "tournament") return "TOURNAMENT";
  if (type === "game_show") return "GAME SHOW";
  return "UPCOMING GAMEPLAY";
}

export function tournamentToPulse(m: TournamentMatch): PulseEvent {
  return {
    id: `tournament:${m.id}`,
    title: `${m.tournament_name} — ${m.match_title}`,
    game_name: m.game,
    event_type: "tournament",
    badge: "TOURNAMENT",
    start_time: m.start_time,
    stream_url: m.stream_url || "",
    status: m.status === "LIVE" ? "LIVE" : "UPCOMING",
  };
}

export function pulseTimeLabel(event: PulseEvent): string {
  if (event.status === "LIVE") return "LIVE NOW";
  return `${countdownLabel(event.start_time)} · ${formatLocalStart(event.start_time)}`;
}

export function nextAlertMilestone(reminder: EventReminder): string {
  const mins = (new Date(reminder.event_start_time).getTime() - Date.now()) / 60000;
  if (mins <= 0) {
    return reminder.notified_live ? "Alerted: LIVE" : "Next alert: when live";
  }
  if (!reminder.notified_48h && mins > 1440) return "Next alert: 2 days before";
  if (!reminder.notified_24h && mins > 30) return "Next alert: 1 day before";
  if (!reminder.notified_30m && mins > 0) return "Next alert: 30 minutes before";
  return "Next alert: when live";
}

export function buildEventWatchPath(event: PulseEvent): string {
  if (!event.stream_url) return "/tournaments";
  try {
    const u = new URL(event.stream_url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      let id = u.searchParams.get("v");
      if (!id && host.includes("youtu.be")) id = u.pathname.replace("/", "");
      if (id) {
        return `/watch/tournament-${encodeURIComponent(event.id)}?platform=youtube&external=${encodeURIComponent(id)}&type=live&title=${encodeURIComponent(event.title)}&streamer=${encodeURIComponent(event.game_name)}&game=${encodeURIComponent(event.game_name)}`;
      }
    }
    if (host.includes("twitch.tv")) {
      const channel = u.pathname.split("/").filter(Boolean)[0];
      if (channel) {
        return `/watch/tournament-${encodeURIComponent(event.id)}?platform=twitch&external=${encodeURIComponent(channel)}&type=live&title=${encodeURIComponent(event.title)}&streamer=${encodeURIComponent(event.game_name)}&game=${encodeURIComponent(event.game_name)}`;
      }
    }
  } catch {
    // fall through
  }
  return "/tournaments";
}

/** Major gaming show / premiere query seeds for YouTube upcoming search */
export const YOUTUBE_EVENT_QUERIES = [
  "Summer Game Fest",
  "The Game Awards",
  "Nintendo Direct",
  "State of Play",
  "Xbox Games Showcase",
];
