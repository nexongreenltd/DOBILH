import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Avatar, Card, Input, PageHeader, Table, TD, TH, THead, TR } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const where: Prisma.AuditLogWhereInput = q ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { entityType: { contains: q, mode: "insensitive" } }, { actor: { name: { contains: q, mode: "insensitive" } } }] } : {};
  const logs = await db.auditLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" description="Admin actions, grade changes, payments and security events." actions={<form><Input name="q" defaultValue={q} placeholder="Filter by action, entity, person" className="w-72" /></form>} />
      <Card>
        <Table>
          <THead><tr><TH>When</TH><TH>Actor</TH><TH>Action</TH><TH>Entity</TH><TH>Details</TH></tr></THead>
          <tbody>
            {logs.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap text-muted-600">{formatDateTime(l.createdAt)}</TD>
                <TD>{l.actor ? <div className="flex items-center gap-2"><Avatar name={l.actor.name} color={l.actor.avatarColor} size={24} /><span className="text-navy-950">{l.actor.name}</span></div> : <span className="text-muted-500">System</span>}</TD>
                <TD><code className="rounded-md bg-azure-50 px-1.5 py-0.5 text-xs text-azure-500">{l.action}</code></TD>
                <TD className="text-muted-600">{l.entityType}{l.entityId ? <span className="block font-mono text-[11px] text-muted-500">{l.entityId.slice(-10)}</span> : null}</TD>
                <TD className="max-w-md"><code className="line-clamp-2 break-all text-[11px] text-muted-600">{l.metadata ? JSON.stringify(l.metadata) : ""}</code></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
