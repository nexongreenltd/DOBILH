import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { platformAnnouncement } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, Checkbox, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncements() {
  await requireAdmin();
  const [courses, items] = await Promise.all([
    db.course.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.announcement.findMany({ include: { author: true, course: true, batch: true }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <PageHeader title="Announcements" description="Platform-wide or per-course messages, delivered as notifications." />
        <Card>
          <CardHeader title="Send an announcement" />
          <ActionForm action={platformAnnouncement} className="space-y-4 p-5" resetOnSuccess>
            <Field label="Audience">
              <Select name="audience" defaultValue="students"><option value="students">All students</option><option value="instructors">All instructors</option><option value="everyone">Everyone</option></Select>
            </Field>
            <Field label="Or a specific course" hint="Overrides the audience above"><Select name="courseId" defaultValue=""><option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
            <Field label="Title"><Input name="title" required /></Field>
            <Field label="Message"><Textarea name="body" rows={5} required /></Field>
            <Checkbox name="sendEmail" label="Also send by email" />
            <SubmitButton>Send</SubmitButton>
          </ActionForm>
        </Card>
      </div>
      <div className="space-y-3 lg:pt-[88px]">
        {items.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-center gap-3">
              {a.author && <Avatar name={a.author.name} color={a.author.avatarColor} size={28} />}
              <span className="flex-1 text-xs text-muted-500">{a.author?.name} · {timeAgo(a.createdAt)}</span>
              <Badge tone="blue">{a.batch?.code ?? a.course?.title ?? "Platform"}</Badge>
            </div>
            <div className="mt-2 font-medium text-navy-950">{a.title}</div>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-600">{a.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
