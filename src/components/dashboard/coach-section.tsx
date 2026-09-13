"use client";
import { useVideos } from "@/hooks/use-videos";
import { ago, isStale } from "@/lib/format";

// YouTube coach — the at-a-glance verdict from Claude: what your recent winners
// have in common, what the flops share, and one experiment to try. The raw
// per-video stats feed the analysis (see /api/videos) but aren't listed here.

export function CoachSection() {
  const { data } = useVideos();
  const nc = data?.status === "not_configured";
  const coach = data?.coach;
  const ready = coach?.status === "ok" && Boolean(coach.headline);
  const stale = ready && isStale(coach?.fetchedAt, 26 * 60 * 60_000);

  return (
    <section className={`section area-coach${stale ? " is-stale" : ""}`}>
      <div className="section-title">
        YouTube Coach <span className="section-caption">Claude · every 12h</span>
      </div>

      {nc ? (
        <span className="not-configured">Not configured</span>
      ) : ready ? (
        <div className="coach-body">
          <div className="coach-headline">{coach!.headline}</div>

          {(coach!.working ?? []).map((b, i) => (
            <div className="coach-line coach-working" key={`w${i}`}>
              <span className="coach-mark">✓</span> {b}
            </div>
          ))}
          {(coach!.avoid ?? []).map((b, i) => (
            <div className="coach-line coach-avoid" key={`a${i}`}>
              <span className="coach-mark">✕</span> {b}
            </div>
          ))}
          {coach!.experiment ? (
            <div className="coach-line coach-experiment">
              <span className="coach-mark">→</span> {coach!.experiment}
            </div>
          ) : null}

          {/* The experiment says what to try; this is the title to actually
              record. Older coach runs predate the field, so it stays optional. */}
          {coach!.titleIdea ? (
            <div className="coach-title-idea">
              <span className="coach-title-label">Title idea</span>
              <span className="coach-title-text">{coach!.titleIdea}</span>
            </div>
          ) : null}

          <div className="coach-footer">
            {coach!.analyzedVideos ?? "—"} videos analyzed · {ago(coach!.fetchedAt)}
          </div>
        </div>
      ) : coach && !coach.configured ? (
        <div className="chart-hint">Add ANTHROPIC_API_KEY to enable the AI coach</div>
      ) : coach?.status === "error" ? (
        <div className="chart-hint">Coach error — see log</div>
      ) : (
        <div className="chart-hint">First analysis pending…</div>
      )}
    </section>
  );
}
