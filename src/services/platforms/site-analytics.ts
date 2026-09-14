import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// First-party website analytics from benattanasio.com's /api/stats endpoint.
//
// Why first-party (not Vercel): Vercel Web Analytics has no public read API, and
// the internal endpoint the old vercel.ts used now 404s. The site tracks its own
// pageviews / unique visitors / sessions / CTA clicks into Upstash and serves them
// at /api/stats, so this is a clean, documented JSON contract we own.
//
// Set SITE_STATS_URL to the full https://…/api/stats URL and SITE_STATS_TOKEN to
// the shared secret (appended as ?token=).

interface StatsWindow {
  pageviews?: number;
  visitors?: number;
  clicks_total?: number;
  clicks_by_location?: Record<string, number>;
  sessions?: number;
  engaged?: number;
  bounce_rate?: number; // 0..1
  ctr?: number; // 0..1  (clicks ÷ pageviews)
  conversion?: number; // 0..1  (clicks ÷ unique visitors)
  /** pg:<slug> → views. Which PAGE was looked at (home, lab, lab_iron-dunes, blog_*). */
  pages?: Record<string, number>;
  /** out:<slug> → clicks. Which LINK/TILE was clicked (a Lab project card, an Elsewhere link). */
  outbound?: Record<string, number>;
  /** ev:<name> → count. Custom events, currently all from the Iron Dunes game. */
  events?: Record<string, number>;
}

interface StatsResponse {
  updatedAt?: string;
  windows?: { "7d"?: StatsWindow; "30d"?: StatsWindow };
  daily?: Array<{
    date: string;
    pageviews?: number;
    visitors?: number;
    clicks?: number;
    bounce_rate?: number;
    lab_views?: number;
    game_views?: number;
    game_starts?: number;
  }>;
}

/** One day of site traffic, persisted as daily snapshots for the 30-day charts. */
export interface SiteDaily {
  date: string;
  pageviews: number;
  visitors: number;
  clicks: number;
  bounce: number; // 0..1
}

/** One page or one clicked link, over both windows. */
export interface LabRow {
  /** Raw key from the stats endpoint — stable, used as the React key. */
  slug: string;
  /** Display form: a path for pages, a title for links. */
  label: string;
  d7: number;
  d30: number;
}

/** Everything the Lab tab shows. Rich (arrays/maps) → the live store, not the
 *  numeric cache, per the RICH-source convention. */
export interface LabData {
  /** Every tracked page, busiest 7d first. */
  pages: LabRow[];
  /** Every tracked link/tile click, busiest 7d first. */
  outbound: LabRow[];
  /** Custom event counts over 7 and 30 days (game_start, game_death, …). */
  events: Record<string, number>;
  events30: Record<string, number>;
  /** 30-day series for the three numbers worth charting. */
  daily: Array<{ date: string; labViews: number; gameViews: number; gameStarts: number }>;
}

export interface SiteResult {
  /** Headline 7-day rollup (+ per-location click counts as loc_* keys). */
  values: MetricValues;
  daily: SiteDaily[];
  /** The Lab breakdown, carved out of the SAME /api/stats response — the Lab tab
   *  costs no extra HTTP call and shares tickSite's cadence and log line. */
  lab: LabData;
}

export function isConfigured(): boolean {
  return Boolean(process.env.SITE_STATS_URL);
}

/** Sanitize a location label into a metric-key-safe suffix. */
function locKey(loc: string): string {
  return "loc_" + loc.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

/** A page slug reads best as the URL it came from: lab_iron-dunes → /lab/iron-dunes. */
function pageLabel(slug: string): string {
  return slug === "home" ? "/" : "/" + slug.split("_").join("/");
}

// Names the slug can't round-trip: internal capitals, dots, or a card title too
// long for a kiosk column. Anything not listed is title-cased, which is right for
// the great majority (scrawl → Scrawl, focus-mode → Focus Mode).
const LINK_LABELS: Record<string, string> = {
  "iron-dunes-rogue-battalions": "Iron Dunes",
  "benattanasio-com": "benattanasio.com",
  "actually-good-flight-finder": "Flight Finder",
  "austin-accountability-tracker": "Austin Tracker",
  "notion-template-maker": "Notion Templates",
  hotmic: "HotMic",
  botspotter: "BotSpotter",
  shortcut: "ShortCut",
  shortsmith: "shortsmith",
  github: "GitHub",
  linkedin: "LinkedIn",
  promptbase: "PromptBase",
  "n8n-builder": "n8n Builder",
  "n8n-explained-simply": "n8n Explained Simply",
  reddit: "Reddit",
  youtube: "YouTube",
};

/** A link slug reads best as its name again: scrawl → "Scrawl". The tracker
 *  slugified the card's own <h3>, so this only has to undo the casing. */
function linkLabel(slug: string): string {
  const fixed = LINK_LABELS[slug];
  if (fixed) return fixed;
  return slug
    .split("-")
    .map((w) => (w === "ai" ? "AI" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Zip the 7d and 30d maps into one sorted row list (busiest week first, then month). */
function rows(
  w7: Record<string, number> | undefined,
  w30: Record<string, number> | undefined,
  label: (slug: string) => string,
): LabRow[] {
  const slugs = new Set([...Object.keys(w7 ?? {}), ...Object.keys(w30 ?? {})]);
  return [...slugs]
    .map((slug) => ({ slug, label: label(slug), d7: w7?.[slug] ?? 0, d30: w30?.[slug] ?? 0 }))
    .sort((a, b) => b.d7 - a.d7 || b.d30 - a.d30 || a.label.localeCompare(b.label));
}

export async function fetchSite(): Promise<SiteResult> {
  const base = process.env.SITE_STATS_URL!;
  const token = process.env.SITE_STATS_TOKEN;
  const url = token
    ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
    : base;

  const data = await fetchJson<StatsResponse>(url);
  const w = data.windows?.["7d"] ?? {};
  const w30 = data.windows?.["30d"] ?? {};

  const values: MetricValues = {
    pageviews7d: w.pageviews ?? 0,
    visitors7d: w.visitors ?? 0,
    clicks7d: w.clicks_total ?? 0,
    ctr: w.ctr ?? 0,
    conversion: w.conversion ?? 0,
    bounce: w.bounce_rate ?? 0,
  };
  for (const [loc, n] of Object.entries(w.clicks_by_location ?? {})) {
    values[locKey(loc)] = typeof n === "number" ? n : 0;
  }

  const daily: SiteDaily[] = (data.daily ?? []).map((d) => ({
    date: d.date,
    pageviews: d.pageviews ?? 0,
    visitors: d.visitors ?? 0,
    clicks: d.clicks ?? 0,
    bounce: d.bounce_rate ?? 0,
  }));

  const lab: LabData = {
    pages: rows(w.pages, w30.pages, pageLabel),
    outbound: rows(w.outbound, w30.outbound, linkLabel),
    events: w.events ?? {},
    events30: w30.events ?? {},
    daily: (data.daily ?? []).map((d) => ({
      date: d.date,
      labViews: d.lab_views ?? 0,
      gameViews: d.game_views ?? 0,
      gameStarts: d.game_starts ?? 0,
    })),
  };

  return { values, daily, lab };
}

/** One-line log summary for the shared site/lab fetch. Lab activity rides along
 *  so the drawer shows it without the Lab needing a second log stream — one
 *  fetch, one line. */
export function summarizeSite(values: MetricValues, lab: LabData): string {
  const parts = [`${values.visitors7d ?? 0} visitors · ${values.pageviews7d ?? 0} views · 7d`];
  const labViews = lab.pages.find((p) => p.slug === "lab")?.d7 ?? 0;
  const tileClicks = lab.outbound.reduce((n, r) => n + r.d7, 0);
  if (labViews || tileClicks) parts.push(`lab ${labViews} views / ${tileClicks} clicks`);
  const plays = lab.events.game_start ?? 0;
  if (plays) parts.push(`${plays} plays`);
  return parts.join(" · ");
}
