import Link from "next/link";
import { BadgeCheck, ShieldX, Search } from "lucide-react";
import { db } from "@/lib/db";
import { Icon3D } from "@/components/icon-3d";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Verify a certificate" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ no?: string }> }) {
  const { no } = await searchParams;
  const code = no?.trim().toUpperCase();
  const cert = code
    ? await db.certificate.findUnique({ where: { certificateNo: code }, include: { user: { select: { name: true } }, course: { select: { title: true } } } })
    : null;

  return (
    <main className="min-h-screen bg-paper px-6 pb-24 pt-32">
      <div className="mx-auto max-w-xl text-center">
        <Icon3D name="shield" size={72} className="mx-auto" />
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-ink">Verify a certificate</h1>
        <p className="mt-3 text-ink-faint">Enter the certificate number printed on a DoB Innovation &amp; Learning Hub certificate.</p>
        <form className="relative mt-8">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
          <input name="no" defaultValue={no} placeholder="DOB-2026-XXXXXX" className="h-14 w-full rounded-2xl border border-line bg-white pl-12 pr-32 uppercase tracking-wider shadow-sm focus:border-lilac-300/70 focus:outline-none focus:ring-4 focus:ring-lilac-400/20" />
          <button className="absolute right-2 top-2 h-10 rounded-xl bg-lilac-500/80 px-5 text-sm font-medium text-white">Verify</button>
        </form>

        {code && (
          <div className="mt-8 rounded-3xl border border-line bg-white p-8 text-left shadow-sm">
            {cert && cert.status === "VALID" ? (
              <>
                <div className="flex items-center gap-3 text-lilac-500"><BadgeCheck className="size-7" /><span className="text-lg font-semibold">Valid certificate</span></div>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs text-ink-faint">Awarded to</dt><dd className="font-semibold text-ink">{cert.user.name}</dd></div>
                  <div><dt className="text-xs text-ink-faint">Course</dt><dd className="font-semibold text-ink">{cert.course.title}</dd></div>
                  <div><dt className="text-xs text-ink-faint">Issued</dt><dd className="font-semibold text-ink">{formatDate(cert.issuedAt)}</dd></div>
                  <div><dt className="text-xs text-ink-faint">Certificate no.</dt><dd className="font-mono font-semibold text-ink">{cert.certificateNo}</dd></div>
                </dl>
                <Link href={`/certificates/${cert.certificateNo}`} className="mt-6 inline-block text-sm font-medium text-lilac-500 hover:underline">View certificate →</Link>
              </>
            ) : (
              <div className="flex items-start gap-3 text-red-700">
                <ShieldX className="size-7 shrink-0" />
                <div>
                  <div className="text-lg font-semibold">{cert ? "This certificate has been revoked" : "No certificate found"}</div>
                  <p className="mt-1 text-sm text-ink-faint">{cert ? cert.revokedReason ?? "Contact DoB for details." : "Check the number and try again."}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
