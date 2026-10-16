import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/rbac";
import { updateUser, resetUserPassword } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, EmptyState, Field, Input, Select, StatusBadge, Table, TD, TH, THead, TR } from "@/components/ui";
import { formatTaka, formatDate, timeAgo } from "@/lib/utils";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      enrollments: { include: { course: true, batch: true }, orderBy: { enrolledAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
      teaching: { include: { course: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!user) notFound();
  const canEdit = actor.role === "SUPER_ADMIN" || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN");
  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-[13px] text-muted-500 hover:text-navy-950">← Users</Link>
      <Card className="flex flex-wrap items-center gap-5 p-6">
        <Avatar name={user.name} color={user.avatarColor} size={60} />
        <div className="flex-1">
          <div className="font-display text-xl font-semibold text-navy-950">{user.name}</div>
          <div className="text-sm text-muted-600">{user.email}{user.phone ? ` · ${user.phone}` : ""}</div>
          <div className="mt-2 flex gap-2"><Badge tone="violet">{ROLE_LABEL[user.role]}</Badge><StatusBadge status={user.status} /><Badge>Joined {formatDate(user.createdAt)}</Badge></div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" description={canEdit ? undefined : "Only a Super Admin can edit administrator accounts."} />
          <ActionForm action={updateUser} className="grid gap-4 p-5 sm:grid-cols-2">
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Name"><Input name="name" defaultValue={user.name} disabled={!canEdit} /></Field>
            <Field label="Phone"><Input name="phone" defaultValue={user.phone ?? ""} disabled={!canEdit} /></Field>
            <Field label="Role">
              <Select name="role" defaultValue={user.role} disabled={!canEdit}>
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
                {(actor.role === "SUPER_ADMIN" || user.role === "ADMIN") && <option value="ADMIN">Admin</option>}
                {(actor.role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN") && <option value="SUPER_ADMIN">Super Admin</option>}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={user.status} disabled={!canEdit}>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending verification</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </Field>
            <Field label="Headline" className="sm:col-span-2"><Input name="headline" defaultValue={user.headline ?? ""} disabled={!canEdit} /></Field>
            {canEdit && <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>}
          </ActionForm>
        </Card>
        <Card>
          <CardHeader title="Reset password" />
          {canEdit ? (
            <ActionForm action={resetUserPassword} className="flex flex-wrap items-end gap-3 p-5" resetOnSuccess>
              <input type="hidden" name="userId" value={user.id} />
              <Field label="New temporary password" className="flex-1"><Input name="password" required minLength={8} /></Field>
              <SubmitButton variant="secondary">Reset</SubmitButton>
            </ActionForm>
          ) : <p className="p-5 text-sm text-muted-500">Not permitted.</p>}
          <div className="border-t border-[#eef1f6] p-5">
            <div className="mb-2 text-[13px] text-muted-500">Recent activity by this user</div>
            {user.auditLogs.length === 0 ? <p className="text-sm text-muted-500">None</p> : user.auditLogs.map((a) => (
              <div key={a.id} className="flex justify-between py-1 text-sm"><code className="text-xs text-navy-950">{a.action}</code><span className="text-xs text-muted-500">{timeAgo(a.createdAt)}</span></div>
            ))}
          </div>
        </Card>
      </div>
      {user.teaching.length > 0 && (
        <Card>
          <CardHeader title="Teaching" />
          <div className="flex flex-wrap gap-2 p-5">{user.teaching.map((t) => <Link key={t.courseId} href={`/admin/courses/${t.courseId}`}><Badge tone="blue">{t.course.title}{t.isLead ? " · lead" : ""}</Badge></Link>)}</div>
        </Card>
      )}
      <Card>
        <CardHeader title="Enrollments" />
        {user.enrollments.length === 0 ? <EmptyState title="No enrollments" /> : (
          <Table>
            <THead><tr><TH>Course</TH><TH>Batch</TH><TH>Status</TH><TH>Enrolled</TH></tr></THead>
            <tbody>{user.enrollments.map((e) => <TR key={e.id}><TD className="font-medium text-navy-950">{e.course.title}</TD><TD>{e.batch?.code}</TD><TD><StatusBadge status={e.status} /></TD><TD>{formatDate(e.enrolledAt)}</TD></TR>)}</tbody>
          </Table>
        )}
      </Card>
      {user.payments.length > 0 && (
        <Card>
          <CardHeader title="Payments" />
          <Table>
            <THead><tr><TH>Invoice</TH><TH>Amount</TH><TH>Method</TH><TH>Status</TH><TH>Date</TH></tr></THead>
            <tbody>{user.payments.map((p) => <TR key={p.id}><TD className="font-mono text-xs">{p.invoiceNo}</TD><TD>{formatTaka(p.amount)}</TD><TD>{p.method}</TD><TD><StatusBadge status={p.status} /></TD><TD>{formatDate(p.paidAt ?? p.createdAt)}</TD></TR>)}</tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
