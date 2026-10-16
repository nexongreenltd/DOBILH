import { Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffOrInstructor } from "@/lib/auth";
import { manageableCourseIds } from "@/lib/learning";
import { createAnnouncement } from "@/app/actions/instructor";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Announcements" };

export default async function Announcements() {
  const user = await requireStaffOrInstructor();
  const ids = await manageableCourseIds(user);
  const [courses, items] = await Promise.all([
    db.course.findMany({ where: { id: { in: ids } }, include: { batches: { where: { status: { in: ["UPCOMING", "RUNNING"] } } } }, orderBy: { title: "asc" } }),
    db.announcement.findMany({ where: { courseId: { in: ids } }, include: { author: true, course: true, batch: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <PageHeader title="Announcements" description="Send updates to a course or a single batch. Learners get an in-app notification." />
        <Card>
          <CardHeader title="New announcement" />
          <ActionForm action={createAnnouncement} className="space-y-4 p-5" resetOnSuccess>
            <Field label="Course">
              <Select name="courseId" required>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
            </Field>
            <Field label="Batch">
              <Select name="batchId" defaultValue="">
                <option value="">All batches</option>
                {courses.flatMap((c) => c.batches.map((b) => <option key={b.id} value={b.id}>{c.title} — {b.name}</option>))}
              </Select>
            </Field>
            <Field label="Title"><Input name="title" required /></Field>
            <Field label="Message"><Textarea name="body" rows={5} required /></Field>
            <SubmitButton>Send announcement</SubmitButton>
          </ActionForm>
        </Card>
      </div>
      <div className="space-y-3 lg:pt-[88px]">
        {items.length === 0 && <Card><EmptyState icon={<Megaphone className="size-5" />} title="No announcements yet" /></Card>}
        {items.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-center gap-3">
              {a.author && <Avatar name={a.author.name} color={a.author.avatarColor} size={30} />}
              <div className="min-w-0 flex-1 text-xs text-muted-500">{a.author?.name} · {timeAgo(a.createdAt)}</div>
              <Badge tone="blue">{a.batch?.code ?? a.course?.title ?? "All"}</Badge>
            </div>
            <div className="mt-2 font-medium text-navy-950">{a.title}</div>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-600">{a.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
