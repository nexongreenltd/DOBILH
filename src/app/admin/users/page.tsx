import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/rbac";
import { createUser } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, Disclosure, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Table, TD, TH, THead, TR, Tabs } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/utils";

export const metadata = { title: "Users & roles" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string }> }) {
  const actor = await requireAdmin();
  const { role, q } = await searchParams;
  const where: Prisma.UserWhereInput = {};
  if (role && role in ROLE_LABEL) where.role = role as Role;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }];
  const [users, counts] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { enrollments: true, teaching: true } } } }),
    db.user.groupBy({ by: ["role"], _count: true }),
  ]);
  const count = (r: string) => counts.find((c) => c.role === r)?._count ?? 0;
  const href = (r?: string) => `/admin/users?${new URLSearchParams({ ...(r ? { role: r } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Users & roles" description="Students, instructors and administrators. Role changes take effect immediately." />
      <Disclosure summary="Add a user">
        <ActionForm action={createUser} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" resetOnSuccess>
          <Field label="Full name"><Input name="name" required /></Field>
          <Field label="Email"><Input name="email" type="email" required /></Field>
          <Field label="Role">
            <Select name="role" defaultValue="STUDENT">
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
              {actor.role === "SUPER_ADMIN" && <option value="ADMIN">Admin</option>}
              {actor.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
            </Select>
          </Field>
          <Field label="Phone"><Input name="phone" /></Field>
          <Field label="Headline"><Input name="headline" placeholder="For instructors" /></Field>
          <Field label="Temporary password"><Input name="password" type="text" required minLength={8} /></Field>
          <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>Create user</SubmitButton></div>
        </ActionForm>
      </Disclosure>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs active={role ?? "all"} tabs={[
          { key: "all", label: `All (${counts.reduce((s, c) => s + c._count, 0)})`, href: href() },
          { key: "STUDENT", label: `Students (${count("STUDENT")})`, href: href("STUDENT") },
          { key: "INSTRUCTOR", label: `Instructors (${count("INSTRUCTOR")})`, href: href("INSTRUCTOR") },
          { key: "ADMIN", label: `Admins (${count("ADMIN") + count("SUPER_ADMIN")})`, href: href("ADMIN") },
        ]} />
        <form className="relative mb-6 w-full max-w-xs">
          {role && <input type="hidden" name="role" value={role} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-500" />
          <Input name="q" defaultValue={q} placeholder="Search name, email, phone" className="pl-9" />
        </form>
      </div>
      <Card>
        {users.length === 0 ? <EmptyState title="No users found" /> : (
          <Table>
            <THead><tr><TH>User</TH><TH>Role</TH><TH>Status</TH><TH>Activity</TH><TH>Joined</TH><TH>Last sign-in</TH></tr></THead>
            <tbody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                      <Avatar name={u.name} color={u.avatarColor} size={32} />
                      <span><span className="block font-medium text-navy-950 hover:text-azure-500">{u.name}</span><span className="block text-xs text-muted-500">{u.email}</span></span>
                    </Link>
                  </TD>
                  <TD><Badge tone={u.role === "STUDENT" ? "slate" : u.role === "INSTRUCTOR" ? "blue" : "violet"}>{ROLE_LABEL[u.role]}</Badge></TD>
                  <TD><StatusBadge status={u.status} /></TD>
                  <TD className="text-muted-600">{u.role === "INSTRUCTOR" ? `${u._count.teaching} courses` : `${u._count.enrollments} enrollments`}</TD>
                  <TD className="whitespace-nowrap text-muted-600">{formatDate(u.createdAt)}</TD>
                  <TD className="whitespace-nowrap text-muted-500">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
