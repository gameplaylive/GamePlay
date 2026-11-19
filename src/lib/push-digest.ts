/** Pick morning / evening / night slots in the device's local timezone. */

export type DigestSlot = "morning" | "evening" | "night";

const SLOT_HOURS: Record<DigestSlot, number> = {
  morning: 9,
  evening: 18,
  night: 21,
};

export function localParts(timezone: string, now = new Date()) {
  const tz = timezone || "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour),
      timezone: tz,
    };
  } catch {
    const iso = now.toISOString();
    return { date: iso.slice(0, 10), hour: now.getUTCHours(), timezone: "UTC" };
  }
}

/** Active slot if local hour is in the send window [slotHour, slotHour+1). */
export function activeDigestSlot(timezone: string, now = new Date()): DigestSlot | null {
  const { hour } = localParts(timezone, now);
  for (const slot of Object.keys(SLOT_HOURS) as DigestSlot[]) {
    if (hour === SLOT_HOURS[slot]) return slot;
  }
  return null;
}

export function digestCopy(slot: DigestSlot): { title: string; body: string; url: string } {
  switch (slot) {
    case "morning":
      return {
        title: "Good morning — who’s live?",
        body: "Tap in for fresh gameplay, tournaments, and your favorite creators.",
        url: "/?tab=live",
      };
    case "evening":
      return {
        title: "Evening drop — GamePlay Live",
        body: "Prime time streams and cups are heating up. Jump back in.",
        url: "/tournaments",
      };
    case "night":
      return {
        title: "Before you sleep — one more match",
        body: "Catch late-night live gameplay and Squad Finder posts.",
        url: "/?tab=live",
      };
  }
}
