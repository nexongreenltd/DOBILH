import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { LogoLockup } from "@/components/logo";
import { PrintButton } from "@/components/print-button";

export async function generateMetadata({ params }: { params: Promise<{ no: string }> }) {
  return { title: `Certificate ${(await params).no}` };
}

export default async function CertificatePage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const cert = await db.certificate.findUnique({
    where: { certificateNo: no },
    include: { user: true, course: { include: { instructors: { where: { isLead: true }, include: { user: true } } } }, enrollment: { include: { batch: true } } },
  });
  if (!cert) notFound();
  const settings = await getSettings();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-200 p-6 print:bg-white print:p-0">
      <div className="no-print flex gap-3">
        <PrintButton />
        <a href="/dashboard/certificates" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">Back</a>
      </div>
      <div className="relative aspect-[1.414] w-full max-w-5xl overflow-hidden bg-white shadow-2xl print:max-w-none print:shadow-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,#efe7ff_0,transparent_42%),radial-gradient(circle_at_10%_90%,#ffc9f533_0,transparent_35%)]" />
        <div className="absolute inset-5 rounded-sm border-2 border-lilac-500/70" />
        <div className="absolute inset-7 rounded-sm border border-lilac-500/25" />
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle_at_40%_60%,#5b2fd6,#8456ff_55%,#c4b5fd)]" />
        <div className="absolute -right-10 -top-10 size-72 rounded-full border-[10px] border-lilac-300/70" />
        {cert.status === "REVOKED" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center"><span className="-rotate-12 rounded-xl border-4 border-red-600 px-8 py-2 text-5xl font-bold text-red-600/80">REVOKED</span></div>
        )}
        <div className="relative flex h-full flex-col px-[8%] py-[7%]">
          <div>
            <LogoLockup />
            <div className="mt-2 text-xs uppercase tracking-[0.25em] text-ink-faint">Dreams of Bangladesh</div>
          </div>
          <div className="mt-[6%] text-sm font-semibold uppercase tracking-[0.35em] text-lilac-500">Certificate of Completion</div>
          <div className="mt-4 text-slate-500">This certifies that</div>
          <div className="mt-2 font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-tight text-ink-950">{cert.user.name}</div>
          <div className="mt-3 max-w-2xl text-slate-600">
            has successfully completed the course <span className="font-semibold text-ink-950">{cert.course.title}</span>
            {cert.enrollment.batch ? ` (${cert.enrollment.batch.name})` : ""}, meeting all requirements for lessons, attendance and assessments
            {cert.finalScore != null ? ` with an overall score of ${Math.round(cert.finalScore)}%` : ""}.
          </div>
          <div className="mt-auto grid grid-cols-3 items-end gap-6 text-sm">
            <div>
              <div className="font-display text-xl text-ink-950" style={{ fontStyle: "italic" }}>{settings.certificateSignatory}</div>
              <div className="mt-1 border-t border-slate-300 pt-1 text-xs text-slate-500">{settings.certificateSignatoryTitle}</div>
            </div>
            <div>
              {cert.course.instructors[0] && (
                <>
                  <div className="font-display text-xl text-ink-950" style={{ fontStyle: "italic" }}>{cert.course.instructors[0].user.name}</div>
                  <div className="mt-1 border-t border-slate-300 pt-1 text-xs text-slate-500">Lead Instructor</div>
                </>
              )}
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Issued {formatDate(cert.issuedAt)}</div>
              <div className="font-mono text-sm font-semibold text-ink-950">{cert.certificateNo}</div>
              <div>Verify at {appUrl.replace(/^https?:\/\//, "")}/verify</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
