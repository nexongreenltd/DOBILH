import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { REPORTS, buildReport, toCsv, type ReportType } from "@/lib/reports";
import { audit } from "@/lib/audit";

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { type } = await params;
  if (!(type in REPORTS)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  const courseId = new URL(req.url).searchParams.get("course");
  const rows = await buildReport(type as ReportType, courseId);
  await audit(user.id, "report.export", "Report", type, { courseId, rows: rows.length });
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dob-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
