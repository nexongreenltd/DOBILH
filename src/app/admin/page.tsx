import Link from "next/link";
import { Users, Library, Layers, CalendarClock, Wallet, FileCheck2, Award, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Card, CardHeader, StatCard, StatusBadge, Avatar, Table, THead, TH, TR, TD } from "@/components/ui";
import { RevenueChart } from "@/components/charts";
import { BarList } from "@/components/bar-list";
import { formatTaka, formatNumber, pct, timeAgo } from "@/lib/utils";

export const metadata = { title: "Admin dashboard" };

export default async function AdminHome() {
  const user = await requireAdmin();
  const now = new Date();
  const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(startDay.getTime() + 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [students, activeCourses, activeBatches, todayClasses, monthRevenue, pendingGrading, enrollAll, enrollDone, paidRecent, byCourse, recentPayments, audits, pendingPayments, attendance] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.batch.count({ where: { status: "RUNNING" } }),
    db.classSession.count({ where: { startsAt: { gte: startDay, lt: endDay }, status: { not: "CANCELLED" } } }),
    db.payment.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.submission.count({ where: { status: "SUBMITTED" } }),
    db.enrollment.count({ where: { status: { in: ["ACTIVE", "COMPLETED"] } } }),
    db.enrollment.count({ where: { status: "COMPLETED" } }),
    db.payment.findMany({ where: { status: "PAID", paidAt: { gte: sixMonths } }, select: { amount: true, paidAt: true } }),
    db.course.findMany({ where: { status: "PUBLISHED" }, select: { title: true, _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED"] } } } } } } }),
    db.payment.findMany({ include: { user: true, enrollment: { include: { course: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.attendance.groupBy({ by: ["status"], _count: true }),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const revenue = months.map((m) => ({
    label: m.toLocaleString("en", { month: "short" }),
    value: paidRecent.filter((p) => p.paidAt && p.paidAt.getFullYear() === m.getFullYear() && p.paidAt.getMonth() === m.getMonth()).reduce((s, p) => s + p.amount, 0),
  }));
  const att = (s: string) => attendance.find((a) => a.status === s)?._count ?? 0;
  const attTotal = attendance.reduce((s, a) => s + a._count, 0);
  const attendanceRate = pct(att("PRESENT") + att("LATE") + att("EXCUSED"), attTotal);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] text-muted-500">Administration</div>
        <h1 className="font-display text-[28px] font-semibold text-navy-950">Hey {user.name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-sm text-muted-600">{pendingPayments ? `${pendingPayments} payment${pendingPayments > 1 ? "s" : ""} awaiting verification · ` : ""}{todayClasses} class{todayClasses === 1 ? "" : "es"} running today.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total students" value={formatNumber(students)} icon={<Users />} accent="sky" />
        <StatCard label="Active courses" value={activeCourses} icon={<Library />} accent="violet" />
        <StatCard label="Active batches" value={activeBatches} icon={<Layers />} accent="brand" />
        <StatCard label="Today’s classes" value={todayClasses} icon={<CalendarClock />} accent="sky" />
        <StatCard label="Monthly revenue" value={formatTaka(monthRevenue._sum.amount ?? 0)} icon={<Wallet />} accent="brand" />
        <StatCard label="Pending grading" value={pendingGrading} icon={<FileCheck2 />} accent="gold" />
        <StatCard label="Completion rate" value={`${pct(enrollDone, enrollAll)}%`} icon={<Award />} accent="violet" hint={`${attendanceRate}% attendance`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Revenue" description="Verified payments, last 6 months" action={<Link href="/admin/reports" className="text-sm font-medium text-azure-500 hover:underline">Reports</Link>} />
          <div className="p-4"><RevenueChart data={revenue} /></div>
        </Card>
        <Card>
          <CardHeader title="Enrollments by course" description="Active and completed learners" />
          <div className="p-5"><BarList rows={byCourse.map((c) => ({ label: c.title, value: c._count.enrollments })).sort((a, b) => b.value - a.value)} format={(v) => `${v} learners`} /></div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Recent payments" action={<Link href="/admin/payments" className="text-sm font-medium text-azure-500 hover:underline">All payments</Link>} />
          <Table>
            <THead><tr><TH>Learner</TH><TH>Course</TH><TH>Amount</TH><TH>Status</TH><TH>When</TH></tr></THead>
            <tbody>
              {recentPayments.map((p) => (
                <TR key={p.id}>
                  <TD><div className="flex items-center gap-2"><Avatar name={p.user.name} color={p.user.avatarColor} size={26} /><span className="font-medium text-navy-950">{p.user.name}</span></div></TD>
                  <TD className="max-w-[220px] truncate text-muted-600">{p.enrollment.course.title}</TD>
                  <TD className="tabular-nums">{formatTaka(p.amount)}</TD>
                  <TD><StatusBadge status={p.status} /></TD>
                  <TD className="whitespace-nowrap text-muted-500">{timeAgo(p.createdAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Activity" action={<Link href="/admin/audit" className="text-sm font-medium text-azure-500 hover:underline">Audit log</Link>} />
          <ul className="space-y-1 p-3">
            {audits.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-azure-50/40">
                <span className="mt-1 flex size-6 items-center justify-center rounded-lg bg-azure-50 text-azure-500"><ArrowUpRight className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-navy-950"><span className="font-medium">{a.actor?.name ?? "System"}</span> · <code className="text-xs text-muted-600">{a.action}</code></div>
                  <div className="text-xs text-muted-500">{a.entityType} · {timeAgo(a.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
