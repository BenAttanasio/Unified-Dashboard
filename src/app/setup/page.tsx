import * as cache from "@/lib/cache";
import { dbAvailable } from "@/lib/db";
import { roster } from "@/lib/roster";
import { ago } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Config/status page for laptop access. Shows whether each env var is PRESENT
// (never its value) and the live fetch status per platform.

const ENV_GROUPS: { group: string; keys: string[] }[] = [
  { group: "YouTube", keys: ["YOUTUBE_API_KEY", "YOUTUBE_CHANNEL_ID"] },
  { group: "Roster channels (roster — initials + handles, .env only)", keys: ["ROSTER_CHANNELS"] },
  {
    group: "Apify (Instagram / TikTok / X)",
    keys: ["APIFY_SOCIAL_API_ENDPOINT", "INSTAGRAM_USERNAME", "TIKTOK_USERNAME", "TWITTER_USERNAME"],
  },
  {
    group: "Apify extras (TikTok likes / Skool members — optional)",
    keys: ["APIFY_TIKTOK_API_ENDPOINT", "APIFY_SKOOL_API_ENDPOINT", "SKOOL_GROUP"],
  },
  { group: "Site analytics (benattanasio.com)", keys: ["SITE_STATS_URL", "SITE_STATS_TOKEN"] },
  { group: "AI coach (Claude)", keys: ["ANTHROPIC_API_KEY"] },
  { group: "Display / Monitoring (optional)", keys: ["NEXT_PUBLIC_SITE_NAME", "MONITOR_SERVICE", "MONITOR_SERVICE_LABEL"] },
];

// Note: the rich weather + roster feeds live in live-store; only their cache
// heartbeats are listed here. The ch_* rows are the per-channel entries.
const PLATFORM_KEYS = ["youtube", "ytvideos", "coach", "roster", "instagram", "tiktok", "tiktok_likes", "skool", "twitter", "site", "apifyBilling", "weather"];

export default function SetupPage() {
  // Roster keys are derived from initials only — no handle is rendered.
  const platformKeys = [...PLATFORM_KEYS, ...roster().map((e) => e.key)];
  const present = (k: string) => Boolean(process.env[k] && process.env[k]!.trim() !== "");

  return (
    <main style={{ padding: "2rem", maxWidth: "48rem", margin: "0 auto", overflow: "auto", height: "100dvh" }}>
      <h1 style={{ color: "var(--primary)", marginBottom: "1.5rem" }}>Dashboard Setup & Status</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ color: "var(--accent)", fontSize: "0.9rem", marginBottom: "0.6rem" }}>
          Environment ({dbAvailable() ? "SQLite OK" : "SQLite unavailable — cache only"})
        </h2>
        {ENV_GROUPS.map((g) => (
          <div key={g.group} style={{ marginBottom: "0.8rem" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>{g.group}</div>
            {g.keys.map((k) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.15rem 0" }}>
                <span>{k}</span>
                <span style={{ color: present(k) ? "var(--ok)" : "var(--crit)" }}>
                  {present(k) ? "set" : "missing"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2 style={{ color: "var(--accent)", fontSize: "0.9rem", marginBottom: "0.6rem" }}>Fetch status</h2>
        {platformKeys.map((key) => {
          const e = cache.getEntry(key);
          const color =
            e.status === "ok" ? "var(--ok)" : e.status === "not_configured" ? "var(--muted)" : "var(--crit)";
          return (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", borderBottom: "1px solid var(--divider)" }}>
              <span style={{ textTransform: "capitalize" }}>{key}</span>
              <span style={{ color }}>
                {e.status}
                {e.fetchedAt ? ` · ${ago(e.fetchedAt)}` : ""}
                {e.error ? ` · ${e.error.slice(0, 60)}` : ""}
              </span>
            </div>
          );
        })}
      </section>
    </main>
  );
}
