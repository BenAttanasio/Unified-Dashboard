// One-off: drop the bad tiktok_likes rows so the service refetches a clean total.
const path = require("path");
const dbPath = process.env.DATABASE_PATH || "./data/dashboard.db";
const db = require("better-sqlite3")(path.resolve(dbPath));
const a = db.prepare("DELETE FROM metric_snapshots WHERE platform = ?").run("tiktok_likes");
const b = db.prepare("DELETE FROM fetch_logs WHERE platform = ?").run("tiktok_likes");
console.log("tiktok_likes snapshots deleted:", a.changes, "logs deleted:", b.changes);
