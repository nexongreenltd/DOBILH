import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { certificateEligibility } from "@/lib/learning";
import { claimCertificate } from "@/app/actions/student";
import { Alert, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { Icon3D } from "@/components/icon-3d";
import { SubmitButton } from "@/components/forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificates" };

export default async function Certificates({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [certs, active] = await Promise.all([
    db.certificate.findMany({ where: { userId: user.id }, include: { course: true }, orderBy: { issuedAt: "desc" } }),
    db.enrollment.findMany({ where: { userId: user.id, status: "ACTIVE" }, select: { courseId: true } }),
  ]);
  const eligibility = (await Promise.all(active.map((e) => certificateEligibility(user.id, e.courseId)))).filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" description="Earned automatically by meeting each course’s progress, attendance and assessment rules." />
      {error === "not-eligible" && <Alert tone="amber">You haven’t met all the requirements yet — see the checklist below.</Alert>}

      {certs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {certs.map((c) => (
            <Card key={c.id} className="relative overflow-hidden p-6">
              <div className="absolute -right-8 -top-8 size-32 rounded-full bg-amber-100/70" />
              <div className="relative flex items-start gap-4">
                <Icon3D name="award" size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><StatusBadge status={c.status} /><span className="font-mono text-xs text-muted-500">{c.certificateNo}</span></div>
                  <div className="mt-2 font-display text-lg font-semibold text-navy-950">{c.course.title}</div>
                  <div className="text-sm text-muted-600">Issued {formatDate(c.issuedAt)}{c.finalScore != null ? ` · Score ${Math.round(c.finalScore)}%` : ""}</div>
                  <div className="mt-4 flex gap-3">
                    <Link href={`/certificates/${c.certificateNo}`} className="inline-flex items-center gap-1.5 rounded-xl bg-navy-950 px-4 py-2 text-sm font-medium text-white">View &amp; download</Link>
                    <Link href={`/verify?no=${c.certificateNo}`} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-azure-500 hover:bg-azure-50"><ExternalLink className="size-4" /> Verification link</Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="In progress" description="Your eligibility for courses you’re currently taking." />
        {eligibility.length === 0 ? (
          <EmptyState title={certs.length ? "No active courses" : "No certificates yet"} description="Enroll in a course to start working towards a certificate." />
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {eligibility.map((e) => (
              <div key={e!.enrollment.id} className="rounded-2xl border border-[#e8ebf1] bg-azure-50/40 p-5">
                <div className="font-medium text-navy-950">{e!.enrollment.course.title}</div>
                <ul className="mt-3 space-y-2">
                  {e!.checks.map((c) => (
                    <li key={c.label} className="flex items-center gap-2.5 text-sm">
                      {c.ok ? <CheckCircle2 className="size-4 text-brand-600" /> : <Circle className="size-4 text-slate-300" />}
                      <span className={c.ok ? "text-navy-950" : "text-muted-600"}>{c.label}</span>
                      <span className="ml-auto font-medium text-navy-950">{c.value}</span>
                    </li>
                  ))}
                </ul>
                <form action={claimCertificate} className="mt-4">
                  <input type="hidden" name="courseId" value={e!.enrollment.courseId} />
                  <SubmitButton variant={e!.eligible ? "primary" : "secondary"} className="w-full" pendingText="Issuing…">
                    {e!.eligible ? "Claim my certificate" : "Not eligible yet"}
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
