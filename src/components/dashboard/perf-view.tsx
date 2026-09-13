"use client";

import { usePerf } from "@/hooks/use-perf";
import type { Cohort, CoachVerdict, Funnel, PerfSnapshot, RuleChange } from "@/lib/perf-snapshot";

/**
 * The performance tab. Read from across a room on a 1280x800 kiosk, so this is
 * big numbers and few marks, not a Studio dashboard.
 *
 * Palette: Okabe-Ito vermillion / blue / bluish-green. Chosen because coral+green
 * (the dashboard's own --primary and --accent) collapse to OKLab dE 0.5 under
 * deuteranopia - indistinguishable. These three pass lightness band, chroma
 * floor, all-pairs CVD separation, normal-vision floor and 3:1 contrast against
 * the #111418 surface. Do not "fix" them back to the brand colors.
 */
const PLATFORMS = [
  { key: "youtube", label: "YOUTUBE", color: "#d55e00" },
  { key: "instagram", label: "INSTAGRAM", color: "#009e73" },
  { key: "linkedin", label: "LINKEDIN", color: "#0072b2" },
] as const;

const SURFACE_LABEL: Record<string, string> = {
  yt_long: "long", yt_short: "shorts", ig_reel: "reels", ig_feed: "feed", li_post: "posts",
};

function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Percent change between two medians. Null unless both sides are real. */
function delta(cur: Cohort | undefined, prev: Cohort | undefined): number | null {
  if (!cur?.median || !prev?.median) return null;
  return ((cur.median - prev.median) / prev.median) * 100;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="perf-delta perf-delta-none">—</span>;
  const up = value >= 0;
  return (
    <span className={`perf-delta ${up ? "perf-delta-up" : "perf-delta-down"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

/**
 * 8-week sparkline. 2px stroke, no axes, no grid - the number above it carries
 * the value and this only carries the shape.
 */
function Spark({ points, color }: { points: number[]; color: string }) {
  const vals = points.map((p) => (Number.isFinite(p) ? p : 0));
  if (vals.length < 2 || vals.every((v) => v === 0)) {
    return <div className="perf-spark perf-spark-empty">no series yet</div>;
  }
  const w = 100, h = 24, max = Math.max(...vals), min = Math.min(...vals);
  const span = max - min || 1;
  const d = vals
    .map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg className="perf-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={d} fill="none" stroke={color} strokeWidth="2"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PlatformColumn({ snap, platform }: { snap: PerfSnapshot; platform: typeof PLATFORMS[number] }) {
  const surfaces = snap.funnels?.[platform.key];
  const weekly = snap.weekly?.[platform.key] ?? [];
  const ingest = snap.ingest?.[platform.key];
  const read = snap.coach?.platforms?.find((p) => p.platform === platform.key);

  if (!surfaces) {
    return (
      <div className="perf-col">
        <div className="perf-col-head" style={{ borderColor: platform.color }}>
          <span className="perf-col-title" style={{ color: platform.color }}>{platform.label}</span>
        </div>
        <div className="perf-empty">no data ingested</div>
      </div>
    );
  }

  const rows = Object.entries(surfaces);
  const impressionsLabel = rows[0]?.[1]?.current_week?.impressions_label ?? "impressions";
  const spark = weekly.map((w) => w.impressions.total ?? 0);

  return (
    <div className="perf-col">
      <div className="perf-col-head" style={{ borderColor: platform.color }}>
        <span className="perf-col-title" style={{ color: platform.color }}>{platform.label}</span>
        {ingest?.status && ingest.status !== "ok" && (
          <span className="perf-badge" title={ingest.note}>{ingest.status}</span>
        )}
      </div>

      {/* The metric name differs per platform on purpose: YouTube counts
          thumbnail impressions, Instagram reports reach, LinkedIn impressions.
          Labelling them identically would invite a false comparison. */}
      <div className="perf-metric-label">{impressionsLabel} · 8wk</div>
      <Spark points={spark} color={platform.color} />

      {rows.map(([surface, w]) => {
        const cur = w.current_week, prev = w.prior_week;
        // A week with nothing published yet, or published too recently to have
        // earned impressions, would show a column of dashes and read as broken.
        // Fall back to the 4-week window and say which one is on screen.
        const useTrailing = cur.impressions.median === null;
        const shown = useTrailing ? w.trailing_4w : cur;
        const windowTag = useTrailing ? "4wk" : "this wk";
        const ratio = shown.ctr_reported?.median ?? shown.ctr_derived_pct ?? shown.views_per_reach;
        const ratioLabel = platform.key === "youtube" ? "CTR" : platform.key === "instagram" ? "v/reach" : "eng";
        const ratioValue =
          ratio !== null && ratio !== undefined
            ? platform.key === "instagram" ? `${ratio.toFixed(2)}x` : `${ratio.toFixed(2)}%`
            : platform.key === "linkedin" ? num(shown.engagements.median) : "—";
        return (
          <div className="perf-surface" key={surface}>
            <div className="perf-surface-name">
              {SURFACE_LABEL[surface] ?? surface}
              {/* Post count must come from the same window as the numbers below
                  it, or "3 posted · 4wk" reads as 3 posts in four weeks. */}
              <span className="perf-n">{shown.posts} posted · {windowTag}</span>
            </div>
            <div className="perf-stats">
              <div className="perf-stat">
                <span className="perf-stat-value" style={{ color: platform.color }}>
                  {num(shown.impressions.median)}
                  {shown.impressions.low_n && <sup className="perf-lown" title="n below 5">*</sup>}
                </span>
                <span className="perf-stat-key">med {impressionsLabel.split(" ")[0]}</span>
              </div>
              <div className="perf-stat">
                <span className="perf-stat-value">
                  {ratioValue}
                  {/* A 0.00% CTR off three posts is a very different claim from
                      one off thirty. The marker has to ride the ratio too. */}
                  {shown.ctr_reported?.low_n && ratioValue !== "—" && (
                    <sup className="perf-lown" title="n below 5">*</sup>
                  )}
                </span>
                <span className="perf-stat-key">{ratioLabel}</span>
              </div>
              <div className="perf-stat">
                <Delta value={delta(cur.impressions, prev.impressions)} />
                <span className="perf-stat-key">vs last wk</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* The coach's read sits with the numbers it came from, not in a separate
          panel — a verdict you have to cross-reference doesn't get read. */}
      {read && (
        <div className="perf-read">
          {read.working.map((b, i) => (
            <div className="perf-read-line is-good" key={`w${i}`}>
              <span className="perf-read-mark">+</span> {b}
            </div>
          ))}
          {read.avoid.map((b, i) => (
            <div className="perf-read-line is-bad" key={`a${i}`}>
              <span className="perf-read-mark">−</span> {b}
            </div>
          ))}
          <div className="perf-read-note">{read.note}</div>
        </div>
      )}
    </div>
  );
}

function CoachPanels({ coach, applied }: { coach: CoachVerdict; applied: RuleChange[] }) {
  const changes = coach.pipeline_changes ?? [];
  return (
    <div className="perf-coach-row">
      <div className="perf-panel">
        <div className="perf-panel-title">RECORD THIS — title ideas from the numbers</div>
        <div className="perf-panel-body">
        {(coach.title_ideas ?? []).map((t, i) => (
          <div className="perf-idea" key={i}>
            <div className="perf-idea-title">
              <span className="perf-idea-surface">{SURFACE_LABEL[t.surface] ?? t.surface}</span>
              {t.title}
            </div>
            <div className="perf-idea-why">{t.why}</div>
          </div>
        ))}
        </div>
        {coach.experiment && (
          <div className="perf-experiment">
            <span className="perf-experiment-label">Experiment</span> {coach.experiment}
          </div>
        )}
      </div>

      <div className="perf-panel">
        <div className="perf-panel-title">REVISE THE PIPELINE — proposed rule changes</div>
        <div className="perf-panel-body">
        {/* Zero proposals is the expected answer most weeks. Say so plainly
            rather than leaving an empty box that reads as a failure. */}
        {!changes.length ? (
          <div className="perf-empty">
            Nothing moved enough this week to justify changing a standing rule.
          </div>
        ) : (
          changes.map((c, i) => (
            <div className="perf-proposal" key={i}>
              <div className="perf-proposal-head">
                <span className={`perf-conf is-${c.confidence}`}>{c.confidence}</span>
                <span className="perf-proposal-change">{c.change}</span>
              </div>
              <div className="perf-proposal-meta">
                <span className="perf-proposal-target">{c.target}</span> · {c.evidence}
              </div>
              <div className="perf-proposal-meta">
                {c.affects}
                {c.reverses && c.reverses.toLowerCase() !== "nothing" && (
                  <span className="perf-reverses"> · reverses: {c.reverses}</span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Already-approved rules and their measured verdict live here too — a
            proposal and the fate of last week's proposal belong side by side. */}
        {applied.length > 0 && (
          <div className="perf-applied">
            <div className="perf-applied-title">Already applied — did they work?</div>
            {applied.map((c) => (
              <div className="perf-applied-row" key={c.id}>
                <span className="perf-applied-rule">{c.rule}</span>
                <span className="perf-applied-verdict">{c.verdict}</span>
              </div>
            ))}
          </div>
        )}
        </div>
        {coach.watch_next && (
          <div className="perf-experiment">
            <span className="perf-experiment-label">Watch next</span> {coach.watch_next}
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeLog({ changes }: { changes: RuleChange[] }) {
  if (!changes.length) {
    return (
      <div className="perf-panel perf-changes-panel">
        <div className="perf-panel-title">RULE CHANGES</div>
        <div className="perf-empty">
          None logged yet. The first approved guideline starts the clock — after that
          this shows whether each rule moved the metric it predicted.
        </div>
      </div>
    );
  }
  return (
    <div className="perf-panel perf-changes-panel">
      <div className="perf-panel-title">RULE CHANGES — did they move what they claimed?</div>
      <div className="perf-change-list">
      {changes.map((c) => {
        const good = c.delta_pct !== null && c.verdict.startsWith("moved as predicted");
        const early = c.verdict.startsWith("too early") || c.verdict.startsWith("no posts");
        return (
          <div className="perf-change" key={c.id}>
            <div className="perf-change-rule">
              <span className="perf-change-id">{c.id}</span> {c.rule}
            </div>
            <div className="perf-change-meta">
              applied {c.applied_at} · {c.metric} ·{" "}
              {num(c.before.median)} (n={c.before.n}) → {num(c.after.median)} (n={c.after.n})
              <span className={`perf-verdict ${early ? "is-early" : good ? "is-good" : "is-bad"}`}>
                {c.verdict}
              </span>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function TopFeatures({ snap }: { snap: PerfSnapshot }) {
  // Strongest title-feature effects across every platform/surface, so the tab
  // answers "what should the next title do" without opening the report.
  const rows: { platform: string; color: string; surface: string; feature: string; multiple: number; n: number; lowN: boolean }[] = [];
  for (const p of PLATFORMS) {
    const bySurface = snap.features?.[p.key] ?? {};
    for (const [surface, list] of Object.entries(bySurface)) {
      for (const f of list) {
        if (f.multiple && (f.multiple >= 1.8 || f.multiple <= 0.55)) {
          rows.push({
            platform: p.label, color: p.color, surface: SURFACE_LABEL[surface] ?? surface,
            feature: f.feature.replace(/_/g, " "), multiple: f.multiple,
            n: f.with.n + f.without.n, lowN: f.low_n,
          });
        }
      }
    }
  }
  rows.sort((a, b) => Math.abs(Math.log(b.multiple)) - Math.abs(Math.log(a.multiple)));
  if (!rows.length) return null;

  return (
    <div className="perf-panel">
      <div className="perf-panel-title">TITLE FEATURES — median views with vs without, 90d</div>
      <div className="perf-feature-grid">
        {rows.slice(0, 8).map((r, i) => (
          <div className="perf-feature" key={i}>
            <span className="perf-feature-dot" style={{ background: r.color }} aria-hidden />
            {/* Platform is named, not just coloured. Identity must never be
                carried by colour alone, and three feature rows can otherwise
                read as duplicates of each other. */}
            <span className="perf-feature-where">{r.platform.slice(0, 2)} {r.surface}</span>
            <span className="perf-feature-name">{r.feature}</span>
            <span className={`perf-feature-mult ${r.multiple >= 1 ? "is-up" : "is-down"}`}>
              {r.multiple.toFixed(2)}x
            </span>
            <span className="perf-feature-n">
              n={r.n}{r.lowN && <span className="perf-lown" title="n below 5">*</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PerfView() {
  const { data, isLoading } = usePerf();

  if (isLoading && !data) return <div className="perf-wrap perf-empty">loading…</div>;
  if (!data || data.status !== "ok" || !data.snapshot) {
    return (
      <div className="perf-wrap">
        <div className="perf-empty">
          {data?.error ?? "No performance snapshot available."}
        </div>
      </div>
    );
  }

  const snap = data.snapshot;
  const age = data.fileModified
    ? Math.round((Date.now() - new Date(data.fileModified).getTime()) / 36e5)
    : null;

  return (
    <div className="perf-wrap">
      <div className="perf-head">
        <span className="perf-head-title">PERFORMANCE</span>
        <span className="perf-head-sub">
          week of {snap.current_week?.[0]}
          {age !== null && <> · snapshot {age < 1 ? "just now" : `${age}h old`}</>}
        </span>
      </div>

      {snap.coach?.headline && (
        <div className="perf-headline">{snap.coach.headline}</div>
      )}

      <div className="perf-cols">
        {PLATFORMS.map((p) => (
          <PlatformColumn key={p.key} snap={snap} platform={p} />
        ))}
      </div>

      {/* With a coach verdict the rule-change log folds into its revise column,
          so only one of these two layouts renders — never both, or they overflow
          the fixed 800px kiosk viewport and overlap. */}
      {snap.coach ? (
        <CoachPanels coach={snap.coach} applied={snap.changes ?? []} />
      ) : (
        <>
          <TopFeatures snap={snap} />
          <ChangeLog changes={snap.changes ?? []} />
        </>
      )}

      {snap.caveats?.length > 0 && (
        <div className="perf-caveats">
          {snap.caveats.map((c, i) => (
            <div key={i} className="perf-caveat">· {c}</div>
          ))}
        </div>
      )}
    </div>
  );
}
