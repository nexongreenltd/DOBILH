import Link from "next/link";
import { Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cancelPendingEnrollment, retryPayment } from "@/app/actions/commerce";
import { Card, EmptyState, PageHeader, StatusBadge, Table, THead, TH, TR, TD } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { formatTaka, formatDate, humanize } from "@/lib/utils";

export const metadata = { title: "Payments" };

export default async function Payments() {
  const user = await requireUser();
  const payments = await db.payment.findMany({ where: { userId: user.id }, include: { enrollment: { include: { course: true } }, coupon: true }, orderBy: { createdAt: "desc" } });
  const paid = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  return (
    <div>
      <PageHeader title="Payments" description={`Invoices and receipts · ${formatTaka(paid)} paid in total`} />
      <Card>
        {payments.length === 0 ? (
          <EmptyState icon={<Wallet className="size-5" />} title="No payments yet" />
        ) : (
          <Table>
            <THead><tr><TH>Invoice</TH><TH>Course</TH><TH>Date</TH><TH>Method</TH><TH>Amount</TH><TH>Status</TH><TH /></tr></THead>
            <tbody>
              {payments.map((p) => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs">{p.invoiceNo}</TD>
                  <TD><Link href={`/courses/${p.enrollment.course.slug}`} className="font-medium text-navy-950 hover:text-azure-500">{p.enrollment.course.title}</Link></TD>
                  <TD className="whitespace-nowrap text-muted-600">{formatDate(p.paidAt ?? p.createdAt)}</TD>
                  <TD className="text-muted-600">{humanize(p.method)}</TD>
                  <TD className="whitespace-nowrap">
                    <span className="font-medium text-navy-950">{formatTaka(p.amount)}</span>
                    {p.discount > 0 && <div className="text-xs text-brand-700">−{formatTaka(p.discount)} {p.coupon?.code}</div>}
                  </TD>
                  <TD><StatusBadge status={p.status} /></TD>
                  <TD className="text-right">
                    {p.status === "PENDING" && (
                      <div className="flex justify-end gap-2">
                        <Link href={`/pay/${p.id}`} className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-semibold text-white">Pay now</Link>
                        <form action={cancelPendingEnrollment}><input type="hidden" name="paymentId" value={p.id} /><SubmitButton size="sm" variant="ghost" confirm="Cancel this enrollment?">Cancel</SubmitButton></form>
                      </div>
                    )}
                    {(p.status === "FAILED" || p.status === "CANCELLED") && p.enrollment.status !== "ACTIVE" && (
                      <form action={retryPayment}><input type="hidden" name="paymentId" value={p.id} /><SubmitButton size="sm" variant="secondary">Retry</SubmitButton></form>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
