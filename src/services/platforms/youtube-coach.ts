import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { YtVideo } from "./youtube-videos";

// AI content coach: once per cadence, sends the recent-video stats plus the
// channel context and measured priors (coach-guidelines.md, gitignored —
// deployed alongside .env) to Claude and gets back a short, structured verdict:
// what's working, what to avoid, one experiment to run.
//
// The context file is deliberately framed as PRIORS, not rules. A coach handed a
// rulebook stops reading the data and starts grading against the rulebook, which
// means it can never surface the thing that worked *because* it broke a rule —
// and on this channel the two best performers both broke the rules in force at
// the time. Keep the prompt and the file pointed at "what does the data say now".

export interface CoachData {
  /** One-line top takeaway shown as the coach headline. */
  headline: string;
  /** Patterns shared by the winners — keep doing these. */
  working: string[];
  /** Patterns shared by the underperformers — stop doing these. */
  avoid: string[];
  /** One concrete experiment for the next upload. */
  experiment: string;
  /** A ready-to-use title for the next video, written in the channel's format. */
  titleIdea: string;
  analyzedVideos: number;
}

const MODEL = "claude-sonnet-5";

// Structured-outputs schema (no min/max constraints — not supported; bullet
// counts are enforced in the prompt instead).
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "working", "avoid", "experiment", "titleIdea"],
  properties: {
    headline: { type: "string", description: "One-line top takeaway, under 15 words" },
    working: { type: "array", items: { type: "string" }, description: "Patterns shared by winners" },
    avoid: { type: "array", items: { type: "string" }, description: "Patterns shared by underperformers" },
    experiment: { type: "string", description: "One concrete experiment for the next upload" },
    titleIdea: {
      type: "string",
      description:
        "A ready-to-record video title, 40-55 characters, that acts on the experiment",
    },
  },
} as const;

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function loadGuidelines(): string {
  const p = process.env.COACH_GUIDELINES_PATH || path.join(process.cwd(), "coach-guidelines.md");
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "(no guidelines file found — judge on general YouTube best practices)";
  }
}

function statsTable(videos: YtVideo[]): string {
  const now = Date.now();
  return videos
    .map((v) => {
      const ageDays = Math.max(0.25, (now - Date.parse(v.publishedAt)) / 86_400_000);
      const vpd = (v.views / ageDays).toFixed(1);
      const kind = v.isShort ? "SHORT" : "LONG";
      const min = Math.floor(v.durationSec / 60);
      const sec = v.durationSec % 60;
      return `[${kind} ${min}:${String(sec).padStart(2, "0")}] "${v.title}" — ${ageDays.toFixed(1)}d old, ${v.views} views (${vpd}/day), ${v.likes} likes, ${v.comments} comments`;
    })
    .join("\n");
}

export async function runCoach(videos: YtVideo[]): Promise<CoachData> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    // Generous, because most of this budget is THINKING, not output. The visible
    // JSON is ~600 tokens; a measured run spent 2,340 reasoning about the stats
    // table first. At 2000 the model exhausted the budget mid-thought and
    // returned a thinking block with no text at all, which surfaced as an
    // "Unterminated string in JSON" parse error. Leave headroom.
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system:
      "You are a sharp, direct YouTube performance coach for a small AI/automation creator channel. " +
      "Your findings come from the CURRENT upload stats, not from the channel context you are given. " +
      "That context supplies priors measured in an earlier window; they sharpen your reading, they do " +
      "not decide it. A video that broke a prior and performed well outranks any confirmation as a " +
      "finding, and so does one that satisfied a prior and flopped — surface those first. Never repeat " +
      "a prior back as a finding, and never judge a video good or bad for matching or breaking one. " +
      "You surface patterns at the TOPIC/STYLE level, not per-video reviews. Judge performance primarily by " +
      "views-per-day relative to other videos of the SAME format (shorts vs long-form are different " +
      "games). Infer topic and hook style from the titles. You cannot see thumbnails, CTR, or retention — " +
      "never assert anything about them. Phrase every bullet as a generalization " +
      "the creator can act on, e.g. \"Business-opportunity angles ('desperate for AI help') pull 5-10x\" " +
      "or \"Upwork tactical how-tos are flopping — 3 of 3 under 10 views/day\". " +
      "The output is a small at-a-glance dashboard tile, so be extremely brief: EXACTLY 2 bullets " +
      "each for working/avoid, each a punchy plain-language phrase UNDER 8 WORDS (e.g. \"Business-pain " +
      "hooks crush it\", \"Upwork tactical titles flop\"). No stat dumps — at most one number total " +
      "across all bullets, only if it lands the point. Headline under 8 words. Experiment under 12 " +
      "words. No hedging, no generic advice. " +
      "Finally, write titleIdea: ONE ready-to-record video title, 40-55 characters, that acts on " +
      "your experiment. It must name a thing a camera can point at (a spreadsheet, a formula, an " +
      "invoice, an inbox) doing a real job, and must NOT be built on an absence — no 'stop', " +
      "'never', 'don't', 'no longer', 'instead', 'without'. Lead with the work, not the tool. " +
      "Write the title itself, not a description of one, and do not reuse a title already in the " +
      "upload list.",
    messages: [
      {
        role: "user",
        content:
          `CHANNEL CONTEXT AND MEASURED PRIORS (observations from an earlier window, not rules):\n${loadGuidelines()}\n\n` +
          `RECENT UPLOADS (newest first):\n${statsTable(videos)}\n\n` +
          "Read the uploads first and form your own view of what separates the winners from the " +
          "losers within each format. Then check that view against the priors, and report what is " +
          "new, what moved, or what is now in question — especially anything that contradicts a prior.",
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`Coach: no text in response (stop_reason ${response.stop_reason})`);
  let parsed: Omit<CoachData, "analyzedVideos">;
  try {
    parsed = JSON.parse(text) as Omit<CoachData, "analyzedVideos">;
  } catch (err) {
    // Name the real cause in the activity log. A truncated response is a token
    // budget problem, not malformed JSON, and the raw parse error hides that.
    const why = response.stop_reason === "max_tokens" ? "response truncated (max_tokens)" : "bad JSON";
    throw new Error(`Coach: ${why} — ${err instanceof Error ? err.message : String(err)}`);
  }
  return { ...parsed, analyzedVideos: videos.length };
}
