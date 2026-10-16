import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { certificateEligibility } from "@/lib/learning";
import { adminIssueCertificate, revokeCertificate } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatusBadge, Table, TD, TH, THead, TR, Tabs } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificates" };

export default async function AdminCertificates({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string }> }) {
  await requireAdmin();
  const { tab = "issued", error } = await searchParams;
  return (
    <div className="space-y-5">
      <PageHeader title="Certificates" description="Rule-based eligibility, issuing, revocation and public verification records." />
      {error === "not-eligible" && <Alert tone="amber">That learner doesn’t meet the course rules yet. Use “Issue anyway” to override (audited).</Alert>}
      <Tabs active={tab} tabs={[{ key: "issued", label: "Issued", href: "?tab=issued" }, { key: "eligible", label: "Eligibility check", href: "?tab=eligible" }]} />
      {tab === "issued" ? <Issued /> : <Eligible />}
    </div>
  );
}

async function Issued() {
  const certs = await db.certificate.findMany({ include: { user: true, course: true }, orderBy: { issuedAt: "desc" } });
  return (
    <Card>
      {certs.length === 0 ? <EmptyState title="No certificates issued yet" /> : (
        <Table>
          <THead><tr><TH>Certificate</TH><TH>Learner</TH><TH>Course</TH><TH>Score</TH><TH>Issued</TH><TH>Status</TH><TH /></tr></THead>
          <tbody>
            {certs.map((c) => (
              <TR key={c.id}>
                <TD><Link href={`/certificates/${c.certificateNo}`} target="_blank" className="font-mono text-xs text-azure-500">{c.certificateNo}</Link></TD>
                <TD className="font-medium text-navy-950">{c.user.name}</TD>
                <TD className="text-muted-600">{c.course.title}</TD>
                <TD>{c.finalScore != null ? `${Math.round(c.finalScore)}%` : "—"}</TD>
                <TD className="whitespace-nowrap text-muted-600">{formatDate(c.issuedAt)}</TD>
                <TD><StatusBadge status={c.status} />{c.revokedReason && <div className="text-xs text-muted-500">{c.revokedReason}</div>}</TD>
                <TD>
                  <form action={revokeCertificate}>
                    <input type="hidden" name="certificateId" value={c.id} />
                    <SubmitButton variant="ghost" size="sm" confirm={c.status === "VALID" ? "Revoke this certificate? Verification will show it as revoked." : "Restore this certificate?"}>{c.status === "VALID" ? "Revoke" : "Restore"}</SubmitButton>
                  </form>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

async function Eligible() {
  const active = await db.enrollment.findMany({ where: { status: "ACTIVE" }, include: { user: true, course: true }, take: 120 });
  const rows = (await Promise.all(active.map(async (e) => ({ e, r: await certificateEligibility(e.userId, e.courseId) })))).filter((x) => x.r);
  rows.sort((a, b) => Number(b.r!.eligible) - Number(a.r!.eligible));
  return (
    <Card>
      <CardHeader title="Active enrollments" description="Eligible learners can also claim certificates themselves from their dashboard." />
      <Table>
        <THead><tr><TH>Learner</TH><TH>Course</TH><TH>Lessons</TH><TH>Attendance</TH><TH>Assessments</TH><TH /></tr></THead>
        <tbody>
          {rows.map(({ e, r }) => (
            <TR key={e.id}>
              <TD className="font-medium text-navy-950">{e.user.name}</TD>
              <TD className="text-muted-600">{e.course.title}</TD>
              {r!.checks.map((c) => <TD key={c.label}><Badge tone={c.ok ? "green" : "slate"}>{c.value}</Badge></TD>)}
              {r!.checks.length < 3 && <TD>—</TD>}
              <TD className="text-right">
                <form action={adminIssueCertificate} className="flex justify-end gap-1">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  {r!.eligible ? <SubmitButton size="sm">Issue</SubmitButton> : <SubmitButton size="sm" variant="ghost" name="force" value="1" confirm="Issue despite unmet requirements? This override is audited.">Issue anyway</SubmitButton>}
                </form>
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
