// One-off: remove the stale 403 error logs left by the old louisdeconinck actor.
const path = require("path");
const dbPath = process.env.DATABASE_PATH || "./data/dashboard.db";
const db = require("better-sqlite3")(path.resolve(dbPath));
const r = db
  .prepare("DELETE FROM fetch_logs WHERE platform = ? AND status = ?")
  .run("skool", "error");
console.log("skool error logs deleted:", r.changes);
