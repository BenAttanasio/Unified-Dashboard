// One-off backfill of 30-day history from SocialBlade screenshots (2026-06-01).
// Inserts daily snapshots (one row per calendar day, latest value wins) so the
// dashboard charts show real 30-day trends immediately instead of waiting to
// accumulate. Idempotent: re-running upserts by (platform, metric, day).
//
// Run ON THE PI from the app dir so better-sqlite3 (aarch64) resolves:
//   cd /home/pi/unified-dashboard && node backfill-socialblade.cjs
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "./data/dashboard.db";

// Expand an inclusive date range to [ "YYYY-MM-DD", value ] points.
function fill(start, end, value) {
  const out = [];
  const d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (; d <= e; d.setUTCDate(d.getUTCDate() + 1)) out.push([d.toISOString().slice(0, 10), value]);
  return out;
}

const series = [
  // YouTube subscribers: ~2,490 all month, +10 step to 2,500 on 05-28.
  {
    platform: "youtube",
    metric: "subscribers",
    points: [...fill("2026-05-03", "2026-05-27", 2490), ...fill("2026-05-28", "2026-06-01", 2500)],
  },
  // YouTube total views (exact daily absolutes from the screenshot).
  {
    platform: "youtube",
    metric: "views",
    points: [
      ["2026-05-03", 75382], ["2026-05-04", 75405], ["2026-05-05", 75421], ["2026-05-06", 75434],
      ["2026-05-07", 75676], ["2026-05-08", 75733], ["2026-05-09", 76695], ["2026-05-10", 76723],
      ["2026-05-11", 76749], ["2026-05-12", 76781], ["2026-05-13", 77932], ["2026-05-14", 77960],
      ["2026-05-15", 77992], ["2026-05-16", 78056], ["2026-05-17", 78085], ["2026-05-18", 78110],
      ["2026-05-19", 78132], ["2026-05-20", 78132], ["2026-05-21", 79847], ["2026-05-22", 79918],
      ["2026-05-23", 81564], ["2026-05-24", 81622], ["2026-05-25", 81652], ["2026-05-26", 81679],
      ["2026-05-27", 81981], ["2026-05-28", 82216], ["2026-05-29", 82809], ["2026-05-30", 84672],
      ["2026-05-31", 84724], ["2026-06-01", 84724],
    ],
  },
  // Instagram followers (exact daily absolutes).
  {
    platform: "instagram",
    metric: "followers",
    points: [
      ["2026-05-03", 76], ["2026-05-04", 75], ["2026-05-05", 74], ["2026-05-06", 75],
      ["2026-05-07", 75], ["2026-05-08", 75], ["2026-05-09", 75], ["2026-05-10", 75],
      ["2026-05-11", 74], ["2026-05-12", 74], ["2026-05-13", 74], ["2026-05-14", 74],
      ["2026-05-15", 74], ["2026-05-16", 74], ["2026-05-17", 74], ["2026-05-18", 73],
      ["2026-05-19", 73], ["2026-05-20", 72], ["2026-05-21", 72], ["2026-05-22", 72],
      ["2026-05-23", 72], ["2026-05-24", 70], ["2026-05-25", 71], ["2026-05-26", 72],
      ["2026-05-27", 72], ["2026-05-28", 72], ["2026-05-29", 72], ["2026-05-30", 72],
      ["2026-05-31", 72], ["2026-06-01", 71],
    ],
  },
  // TikTok followers (screenshot starts 05-10).
  {
    platform: "tiktok",
    metric: "followers",
    points: [
      ["2026-05-10", 31], ["2026-05-11", 31], ["2026-05-12", 31], ["2026-05-13", 32],
      ["2026-05-14", 32], ["2026-05-15", 33], ["2026-05-16", 33], ["2026-05-17", 33],
      ["2026-05-18", 33], ["2026-05-19", 33], ["2026-05-20", 33], ["2026-05-21", 33],
      ["2026-05-22", 33], ["2026-05-23", 33], ["2026-05-24", 33], ["2026-05-25", 33],
      ["2026-05-26", 33], ["2026-05-27", 33], ["2026-05-28", 33], ["2026-05-29", 34],
      ["2026-05-30", 34], ["2026-05-31", 34],
    ],
  },
  // Twitter/X followers: 87 → 90, +1 on May 11, 15, 20 (per the user).
  {
    platform: "twitter",
    metric: "followers",
    points: [
      ...fill("2026-05-03", "2026-05-10", 87),
      ...fill("2026-05-11", "2026-05-14", 88),
      ...fill("2026-05-15", "2026-05-19", 89),
      ...fill("2026-05-20", "2026-06-01", 90),
    ],
  },
];

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
const find = db.prepare(
  "SELECT id FROM metric_snapshots WHERE platform=? AND metric_name=? AND date(recorded_at)=date(?) LIMIT 1",
);
const upd = db.prepare("UPDATE metric_snapshots SET metric_value=? WHERE id=?");
const ins = db.prepare(
  "INSERT INTO metric_snapshots (platform, metric_name, metric_value, recorded_at) VALUES (?,?,?,?)",
);

let inserted = 0;
let updated = 0;
const tx = db.transaction(() => {
  for (const s of series) {
    for (const [date, value] of s.points) {
      const recordedAt = `${date} 12:00:00`;
      const row = find.get(s.platform, s.metric, recordedAt);
      if (row) {
        upd.run(value, row.id);
        updated++;
      } else {
        ins.run(s.platform, s.metric, value, recordedAt);
        inserted++;
      }
    }
  }
});
tx();
console.log(`backfill done: ${inserted} inserted, ${updated} updated across ${series.length} series`);
db.close();
