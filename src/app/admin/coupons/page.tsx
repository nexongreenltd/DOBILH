import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createCoupon, toggleCoupon } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Disclosure, Field, Input, PageHeader, Select, Table, TD, TH, THead, TR } from "@/components/ui";
import { formatTaka, formatDate } from "@/lib/utils";

export const metadata = { title: "Coupons" };

export default async function AdminCoupons() {
  await requireAdmin();
  const [coupons, courses] = await Promise.all([
    db.coupon.findMany({ include: { course: true, payments: { where: { status: "PAID" }, select: { discount: true } } }, orderBy: { createdAt: "desc" } }),
    db.course.findMany({ where: { price: { gt: 0 } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const now = new Date();
  return (
    <div className="space-y-5">
      <PageHeader title="Coupons" description="Percentage or fixed discounts — course-specific or platform-wide, with usage limits." />
      <Disclosure summary="Create a coupon">
        <ActionForm action={createCoupon} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" resetOnSuccess>
          <Field label="Code"><Input name="code" required placeholder="EID2026" className="uppercase" /></Field>
          <Field label="Type"><Select name="discountType"><option value="PERCENT">Percent off</option><option value="FIXED">Fixed amount (BDT)</option></Select></Field>
          <Field label="Value"><Input name="discountValue" type="number" min={1} required /></Field>
          <Field label="Course"><Select name="courseId" defaultValue=""><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
          <Field label="Max total uses" hint="Blank = unlimited"><Input name="maxUses" type="number" min={1} /></Field>
          <Field label="Uses per learner"><Input name="perUserLimit" type="number" min={1} defaultValue={1} /></Field>
          <Field label="Valid from"><Input name="validFrom" type="datetime-local" /></Field>
          <Field label="Valid until"><Input name="validUntil" type="datetime-local" /></Field>
          <Field label="Description" className="sm:col-span-2 lg:col-span-4"><Input name="description" /></Field>
          <div><SubmitButton>Create coupon</SubmitButton></div>
        </ActionForm>
      </Disclosure>
      <Card>
        <Table>
          <THead><tr><TH>Code</TH><TH>Discount</TH><TH>Applies to</TH><TH>Usage</TH><TH>Total discounted</TH><TH>Valid until</TH><TH>Status</TH><TH /></tr></THead>
          <tbody>
            {coupons.map((c) => {
              const expired = c.validUntil && c.validUntil < now;
              return (
                <TR key={c.id}>
                  <TD><code className="rounded-md bg-azure-50 px-2 py-1 text-xs font-semibold text-azure-500">{c.code}</code><div className="mt-1 text-xs text-muted-500">{c.description}</div></TD>
                  <TD className="whitespace-nowrap">{c.discountType === "PERCENT" ? `${c.discountValue}%` : formatTaka(c.discountValue)}</TD>
                  <TD className="text-muted-600">{c.course?.title ?? "All courses"}</TD>
                  <TD className="tabular-nums">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</TD>
                  <TD className="tabular-nums">{formatTaka(c.payments.reduce((s, p) => s + p.discount, 0))}</TD>
                  <TD className="whitespace-nowrap text-muted-600">{c.validUntil ? formatDate(c.validUntil) : "No expiry"}</TD>
                  <TD>{expired ? <Badge tone="red">Expired</Badge> : c.active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge>}</TD>
                  <TD><form action={toggleCoupon}><input type="hidden" name="couponId" value={c.id} /><SubmitButton variant="ghost" size="sm">{c.active ? "Disable" : "Enable"}</SubmitButton></form></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
