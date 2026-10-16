import type { PaymentStatus, Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminPaymentAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Card, Input, PageHeader, StatCard, StatusBadge, Table, TD, TH, THead, TR, Tabs } from "@/components/ui";
import { formatTaka, formatDateTime, humanize } from "@/lib/utils";

export const metadata = { title: "Payments" };

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const where: Prisma.PaymentWhereInput = {};
  if (status) where.status = status as PaymentStatus;
  if (q) where.OR = [{ invoiceNo: { contains: q, mode: "insensitive" } }, { gatewayRef: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }, { user: { name: { contains: q, mode: "insensitive" } } }];
  const [rows, totals] = await Promise.all([
    db.payment.findMany({ where, include: { user: true, enrollment: { include: { course: true } }, coupon: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.payment.groupBy({ by: ["status"], _sum: { amount: true, discount: true }, _count: true }),
  ]);
  const t = (s: string) => totals.find((x) => x.status === s);
  const href = (s?: string) => `/admin/payments?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(q ? { q } : {}) })}`;
  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="Transactions, verification, refunds and manual adjustments. Every action is audited." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Collected" value={formatTaka(t("PAID")?._sum.amount ?? 0)} hint={`${t("PAID")?._count ?? 0} payments`} accent="brand" />
        <StatCard label="Pending" value={formatTaka(t("PENDING")?._sum.amount ?? 0)} hint={`${t("PENDING")?._count ?? 0} awaiting verification`} accent="gold" />
        <StatCard label="Refunded" value={formatTaka(t("REFUNDED")?._sum.amount ?? 0)} hint={`${t("REFUNDED")?._count ?? 0} refunds`} accent="violet" />
        <StatCard label="Discounts given" value={formatTaka(t("PAID")?._sum.discount ?? 0)} hint="via coupons" accent="sky" />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tabs active={status ?? "all"} tabs={[{ key: "all", label: "All", href: href() }, ...["PAID", "PENDING", "FAILED", "REFUNDED", "CANCELLED"].map((s) => ({ key: s, label: humanize(s), href: href(s) }))]} />
        <form className="relative w-full max-w-xs">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-500" />
          <Input name="q" defaultValue={q} placeholder="Invoice, transaction, learner" className="pl-9" />
        </form>
      </div>
      <Card>
        <Table>
          <THead><tr><TH>Invoice</TH><TH>Learner</TH><TH>Course</TH><TH>Amount</TH><TH>Method</TH><TH>Status</TH><TH>Date</TH><TH /></tr></THead>
          <tbody>
            {rows.length === 0 && <TR><TD colSpan={8} className="py-10 text-center text-muted-500">No payments match this filter.</TD></TR>}
            {rows.map((p) => (
              <TR key={p.id}>
                <TD><div className="font-mono text-xs text-navy-950">{p.invoiceNo}</div><div className="font-mono text-[11px] text-muted-500">{p.gatewayRef}</div></TD>
                <TD><div className="font-medium text-navy-950">{p.user.name}</div><div className="text-xs text-muted-500">{p.user.email}</div></TD>
                <TD className="max-w-[200px] truncate text-muted-600">{p.enrollment.course.title}</TD>
                <TD className="whitespace-nowrap tabular-nums">{formatTaka(p.amount)}{p.discount > 0 && <div className="text-xs text-brand-700">−{formatTaka(p.discount)} {p.coupon?.code}</div>}</TD>
                <TD className="text-muted-600">{humanize(p.method)}</TD>
                <TD><StatusBadge status={p.status} /></TD>
                <TD className="whitespace-nowrap text-muted-600">{formatDateTime(p.paidAt ?? p.createdAt)}</TD>
                <TD className="text-right">
                  <form action={adminPaymentAction} className="flex justify-end gap-1">
                    <input type="hidden" name="paymentId" value={p.id} />
                    {p.status === "PENDING" && <>
                      <SubmitButton name="action" value="verify" size="sm" confirm="Mark this payment as received and activate the enrollment?">Verify</SubmitButton>
                      <SubmitButton name="action" value="cancel" variant="ghost" size="sm">Cancel</SubmitButton>
                    </>}
                    {p.status === "PAID" && p.amount > 0 && <SubmitButton name="action" value="refund" variant="ghost" size="sm" confirm="Refund this payment? The enrollment will be cancelled.">Refund</SubmitButton>}
                  </form>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
