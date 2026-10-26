/**
 * Runs once when the server starts. Recording conversion happens in-process, so a replay still
 * marked PROCESSING at boot was interrupted by a restart or deploy: mark it FAILED so staff can
 * press "Retry" (the raw segments are still on the storage volume).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { db } = await import("./lib/db");
    const { count } = await db.classSession.updateMany({ where: { recordingStatus: "PROCESSING" }, data: { recordingStatus: "FAILED" } });
    if (count) console.warn(`[startup] ${count} interrupted recording(s) marked FAILED — retry them from Admin → Live classes.`);
  } catch (e) {
    console.error("[startup] recording check skipped:", e instanceof Error ? e.message : e);
  }
}
