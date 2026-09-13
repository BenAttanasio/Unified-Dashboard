// Next.js runs this once when the server process boots. We use it to start the
// background scheduler. Guarded to the Node.js runtime so it never runs on the
// Edge runtime (where setInterval/fs aren't appropriate).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./services/scheduler");
    startScheduler();
  }
}
