"use client";
import { useRoster } from "@/hooks/use-roster";
import { useHistory } from "@/hooks/use-history";
import { compact, full, signed, deltaClass, trendDirection, trendColor } from "@/lib/format";
import { Sparkline } from "./sparkline";
import type { RosterRow } from "@/lib/types";

// The channel roster. Channels are identified by initials ONLY — handles and
// names live in .env and never reach the browser (see src/lib/roster.ts).
//
// The question this section answers is "is one of these blowing up?", so the
// headline number for a YouTube row is total VIEWS (the thing that actually
// moves) with subscribers demoted to the sub-line, and each row carries the
// views of its recent uploads as a bar strip: one bar towering over the rest is
// the earliest visible sign that a video has taken off.

const TAG: Record<RosterRow["platform"], string> = { yt: "YT", ig: "IG", tt: "TT" };

/** "4.2×" — the multiple driving the hot flag. */
function times(x: number | null): string {
  return x == null ? "" : `${x >= 10 ? Math.round(x) : x.toFixed(1)}×`;
}

/** Recent uploads, oldest → newest. The tallest bar is the one to notice. */
function UploadBars({ views, hot }: { views: number[]; hot: boolean }) {
  const max = Math.max(...views);
  // Only call out a peak when there's a real one: on an all-zero or all-equal
  // strip every bar would qualify, which just paints the whole row.
  const showPeak = max > 0 && views.length >= 3 && views.some((v) => v !== max);
  return (
    <div className="rost-bars" role="img" aria-label={`Views of the ${views.length} most recent uploads`}>
      {views.map((v, i) => (
        <span
          key={i}
          className={`rost-bar${showPeak && v === max ? (hot ? " is-peak-hot" : " is-peak") : ""}`}
          style={{ height: `${max > 0 ? Math.max(6, (v / max) * 100) : 6}%` }}
          title={`${full(v)} views`}
        />
      ))}
    </div>
  );
}

/**
 * IG / TikTok have no per-post feed here — chart the follower history instead.
 * Sits INLINE between the label and the number rather than spanning the row:
 * full-width in a ~1rem-tall row gives a ~30:1 box, and a line stretched that
 * flat can't show a shape at all.
 */
function FollowerSpark({ row }: { row: RosterRow }) {
  const { data } = useHistory(row.key, row.metric, 30, row.status !== "not_configured");
  const points = data?.points ?? [];
  return (
    <span className="rost-spark-inline">
      <Sparkline
        points={points}
        color={trendColor(trendDirection(points, row.d7))}
        ariaLabel={`${row.label} follower trend`}
      />
    </span>
  );
}

/** "+12" plus the span it actually covers, so a short window can't mislead. */
function Delta({ row }: { row: RosterRow }) {
  if (row.d7 == null || row.d7 === 0) return null;
  const span = row.windowDays ?? 7;
  return (
    <span
      className={`rost-delta ${deltaClass(row.d7)}`}
      title={`${signed(row.d7)} over the last ${span} day${span === 1 ? "" : "s"}`}
    >
      {signed(row.d7)}
      {span < 7 ? <span className="rost-delta-span">/{span}d</span> : null}
    </span>
  );
}

function Row({ row }: { row: RosterRow }) {
  // "Blank" covers both "no source configured" and "source hasn't run yet" —
  // they look the same but must not read the same.
  const nc = row.count == null;
  const heat = row.spike ?? row.accel;

  const social = row.platform !== "yt";

  return (
    <div
      className={`rost-row${social ? " rost-row-social" : ""}${row.hot ? " is-hot" : ""}${nc ? " is-nc" : ""}`}
    >
      <div className="rost-head">
        <span className="rost-id">
          <span className="rost-label">{row.label}</span>
          <span className="rost-tag">{TAG[row.platform]}</span>
        </span>
        {/* Social rows are a single line: the trend sits between the label and
            the number, which is the only place it gets a legible aspect ratio. */}
        {!nc && social ? <FollowerSpark row={row} /> : null}
        {nc ? (
          <span className="not-configured">
            {row.pending ? "Awaiting first fetch" : "Not configured"}
          </span>
        ) : (
          <span className="rost-figures">
            {row.hot ? <span className="rost-heat">🔥 {times(heat)}</span> : null}
            <span className="rost-count">{compact(row.count)}</span>
            <Delta row={row} />
          </span>
        )}
      </div>

      {!nc && !social ? (
        <>
          <div className="rost-sub">
            {compact(row.subscribers)} subs
            {row.lastUploadDays != null
              ? ` · last upload ${row.lastUploadDays === 0 ? "today" : `${row.lastUploadDays}d ago`}`
              : ""}
            {!row.hot && row.spike != null ? ` · ${times(row.spike)} spike` : ""}
          </div>
          {row.recentViews.length > 0 ? <UploadBars views={row.recentViews} hot={row.hot} /> : null}
        </>
      ) : null}
    </div>
  );
}

export function RosterSection() {
  const { data } = useRoster();
  const rows = data?.channels ?? [];
  // Whatever's popping floats to the top — that's the whole point of the panel.
  const sorted = [...rows].sort((a, b) => Number(b.hot) - Number(a.hot));

  return (
    <section className="section area-roster">
      <div className="section-title">
        Roster <span className="section-caption">views · Δ≤7d · 🔥 = popping</span>
      </div>
      <div className="rost-list">
        {sorted.map((r) => (
          <Row key={r.key} row={r} />
        ))}
        {rows.length === 0 ? (
          <span className="not-configured">
            {data ? "Set ROSTER_CHANNELS in .env" : "Loading…"}
          </span>
        ) : null}
      </div>
    </section>
  );
}
