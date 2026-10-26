import { NextResponse } from "next/server";
import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { objectPath, signedReadUrl } from "@/lib/storage";
import { replayAccess } from "@/lib/live";

/**
 * Brokered file access: paid-course files are never exposed by public URL.
 * Access is granted to staff, the uploader, course instructors, enrolled learners
 * (for published lessons), and anyone for PUBLIC/preview materials. Live-class replays
 * additionally follow the replay policy (batch scope + retention). With R2 the request is
 * answered by a 10-minute signed link; locally the file streams with HTTP Range support.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.storedFile.findUnique({
    where: { id },
    include: {
      materials: {
        include: {
          lesson: { select: { courseId: true, isPreview: true, publishAt: true } },
          recordingOf: { select: { batchId: true, liveEndedAt: true, batch: { select: { courseId: true } } } },
        },
      },
      submissions: { include: { assessment: { select: { courseId: true } } } },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getCurrentUser();
  const isReplay = file.materials.some((m) => m.recordingOf);
  const isPublic = !isReplay && file.materials.some((m) => m.visibility === "PUBLIC" || m.lesson.isPreview);

  let allowed = isPublic;
  if (!allowed && user) {
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || file.uploadedById === user.id) allowed = true;
    const courseIds = [...new Set([...file.materials.map((m) => m.lesson.courseId), ...file.submissions.map((s) => s.assessment.courseId)])];
    if (!allowed && courseIds.length) {
      const teaches = await db.courseInstructor.count({ where: { userId: user.id, courseId: { in: courseIds } } });
      if (teaches > 0) allowed = true;
    }
    if (!allowed && file.submissions.some((s) => s.studentId === user.id)) allowed = true;
    if (!allowed && isReplay) {
      const recMat = file.materials.find((m) => m.recordingOf)!;
      if (recMat.visibility === "HIDDEN") return NextResponse.json({ error: "This replay has been withdrawn." }, { status: 403 });
      const r = await replayAccess(user.id, user.role, recMat.recordingOf!);
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 403 });
      allowed = true;
    }
    if (!allowed) {
      const now = new Date();
      const visible = file.materials.filter((m) => m.visibility === "ENROLLED" && m.lesson.publishAt && m.lesson.publishAt <= now);
      if (visible.length) {
        const enrolled = await db.enrollment.count({
          where: { userId: user.id, courseId: { in: visible.map((m) => m.lesson.courseId) }, status: { in: ["ACTIVE", "COMPLETED"] } },
        });
        allowed = enrolled > 0;
      }
    }
  }
  if (!allowed) return NextResponse.json({ error: user ? "Forbidden" : "Sign in required" }, { status: user ? 403 : 401 });

  const download = new URL(req.url).searchParams.has("download") && !isReplay; // replays stream only
  const signed = await signedReadUrl(file.key, { filename: file.originalName, contentType: file.mimeType, download });
  if (signed) return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });

  const full = objectPath(file.key);
  const { size } = await fs.stat(full);
  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(file.originalName)}"`,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2]!, 10);
    let end = range[1] && range[2] ? parseInt(range[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1, start + 8 * 1024 * 1024 - 1); // cap each range at 8 MB
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
