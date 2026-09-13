// One-off backfill of historical daily snapshots so the new sparklines show real
// 30-day trends immediately. Idempotent: clears prior backfill (recorded_at before
// today) for each metric, then re-inserts. Today's live snapshot is left untouched.
const path = require("path");
const dbPath = process.env.DATABASE_PATH || "./data/dashboard.db";
const db = require("better-sqlite3")(path.resolve(dbPath));

// TikTok lifetime likes/hearts — exact daily totals from SocialBlade screenshot.
const tiktokLikes = {
  "2026-05-10": 538, "2026-05-11": 543, "2026-05-12": 557, "2026-05-13": 577,
  "2026-05-14": 588, "2026-05-15": 593, "2026-05-16": 594, "2026-05-17": 596,
  "2026-05-18": 597, "2026-05-19": 598, "2026-05-20": 599, "2026-05-21": 599,
  "2026-05-22": 601, "2026-05-23": 603, "2026-05-24": 604, "2026-05-25": 605,
  "2026-05-26": 605, "2026-05-27": 607, "2026-05-28": 607, "2026-05-29": 611,
  "2026-05-30": 612, "2026-05-31": 613,
};

// Skool members — reconstructed from signup events (current 101, 6 joins in last
// 30d: +1 on 5/8, 5/13, 5/17, 5/19 and +2 on 5/30 → 95 before 5/8).
const skoolMembers = {
  "2026-05-03": 95, "2026-05-04": 95, "2026-05-05": 95, "2026-05-06": 95,
  "2026-05-07": 95, "2026-05-08": 96, "2026-05-09": 96, "2026-05-10": 96,
  "2026-05-11": 96, "2026-05-12": 96, "2026-05-13": 97, "2026-05-14": 97,
  "2026-05-15": 97, "2026-05-16": 97, "2026-05-17": 98, "2026-05-18": 98,
  "2026-05-19": 99, "2026-05-20": 99, "2026-05-21": 99, "2026-05-22": 99,
  "2026-05-23": 99, "2026-05-24": 99, "2026-05-25": 99, "2026-05-26": 99,
  "2026-05-27": 99, "2026-05-28": 99, "2026-05-29": 99, "2026-05-30": 101,
  "2026-05-31": 101,
};

const TODAY = "2026-06-01";

function backfill(platform, metric, series) {
  const del = db
    .prepare("DELETE FROM metric_snapshots WHERE platform=? AND metric_name=? AND recorded_at < ?")
    .run(platform, metric, TODAY);
  const ins = db.prepare(
    "INSERT INTO metric_snapshots (platform, metric_name, metric_value, recorded_at) VALUES (?,?,?,?)",
  );
  const tx = db.transaction((rows) => {
    for (const [date, value] of rows) ins.run(platform, metric, value, `${date} 12:00:00`);
  });
  tx(Object.entries(series));
  console.log(`${platform}/${metric}: cleared ${del.changes}, inserted ${Object.keys(series).length}`);
}

backfill("tiktok_likes", "likes", tiktokLikes);
backfill("skool", "members", skoolMembers);
