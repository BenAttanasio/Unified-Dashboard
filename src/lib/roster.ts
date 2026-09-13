// Roster of tracked channels.
//
// PRIVACY: this repo is PUBLIC. Handles, URLs and real channel names must NEVER
// appear in source — they live ONLY in .env under ROSTER_CHANNELS, and the
// dashboard shows nothing but the initials supplied there. Server-only module:
// `handle` is used to build API/scraper inputs and is never sent to the client
// (the API route strips it — see src/app/api/roster/route.ts).
//
// Format: comma-separated `LABEL:platform:handle`, platform ∈ yt | ig | tt, e.g.
//   ROSTER_CHANNELS=X.Y.:yt:somehandle,Z.Z.:ig:someone,Z.Z.:tt:someone

export type RosterPlatform = "yt" | "ig" | "tt";

const PLATFORMS: RosterPlatform[] = ["yt", "ig", "tt"];

export interface RosterEntry {
  /** Stable cache / snapshot key derived from the label, e.g. "ch_xy_yt". */
  key: string;
  /** Initials shown on the dashboard (straight from env — never a real name). */
  label: string;
  platform: RosterPlatform;
  /** Handle without a leading @. SERVER ONLY — never serialize this. */
  handle: string;
}

/** "X.Y." → "xy" so keys stay SQLite/URL-friendly. */
function slug(label: string): string {
  return label.replace(/[^a-z0-9]/gi, "").toLowerCase() || "x";
}

/** Parse ROSTER_CHANNELS. Malformed entries are skipped, never thrown on. */
export function roster(): RosterEntry[] {
  const raw = process.env.ROSTER_CHANNELS;
  if (!raw) return [];

  const out: RosterEntry[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const bits = part.trim().split(":");
    if (bits.length < 3) continue;
    const label = bits[0].trim();
    const platform = bits[1].trim().toLowerCase() as RosterPlatform;
    // Re-join the tail so a handle containing ":" can't silently truncate.
    const handle = bits.slice(2).join(":").trim().replace(/^@/, "");
    if (!label || !handle || !PLATFORMS.includes(platform)) continue;

    let key = `ch_${slug(label)}_${platform}`;
    if (seen.has(key)) {
      let n = 2;
      while (seen.has(`${key}${n}`)) n++;
      key = `${key}${n}`;
    }
    seen.add(key);
    out.push({ key, label, platform, handle });
  }
  return out;
}

export function byPlatform(platform: RosterPlatform): RosterEntry[] {
  return roster().filter((e) => e.platform === platform);
}

export function isConfigured(): boolean {
  return roster().length > 0;
}
