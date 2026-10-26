import { json, liveContext } from "@/lib/live-api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  const s = ctx.session;
  return json({
    state: ctx.access.state,
    canConnect: ctx.access.canConnect,
    recordingStatus: s.recordingStatus,
    liveStartedAt: s.liveStartedAt,
    replayLessonId: s.recordingStatus === "READY" ? s.lessonId : null,
    courseId: s.batch.courseId,
  });
}
