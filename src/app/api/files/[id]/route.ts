import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readObject } from "@/lib/storage";

/**
 * Brokered file access: paid-course files are never exposed by public URL.
 * Access is granted to staff, the uploader, course instructors, enrolled learners
 * (for published lessons), and anyone for PUBLIC/preview materials.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.storedFile.findUnique({
    where: { id },
    include: {
      materials: { include: { lesson: { select: { courseId: true, isPreview: true, publishAt: true } } } },
      submissions: { include: { assessment: { select: { courseId: true } } } },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getCurrentUser();
  const isPublic = file.materials.some((m) => m.visibility === "PUBLIC" || m.lesson.isPreview);

  let allowed = isPublic;
  if (!allowed && user) {
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || file.uploadedById === user.id) allowed = true;
    const courseIds = [...new Set([...file.materials.map((m) => m.lesson.courseId), ...file.submissions.map((s) => s.assessment.courseId)])];
    if (!allowed && courseIds.length) {
      const teaches = await db.courseInstructor.count({ where: { userId: user.id, courseId: { in: courseIds } } });
      if (teaches > 0) allowed = true;
    }
    if (!allowed && file.submissions.some((s) => s.studentId === user.id)) allowed = true;
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

  const body = await readObject(file.key);
  const download = new URL(req.url).searchParams.has("download");
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(file.originalName)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
