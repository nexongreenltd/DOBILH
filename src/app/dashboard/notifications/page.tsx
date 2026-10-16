import { Bell, CheckCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { markAllRead, openNotification } from "@/app/actions/student";
import { Card, EmptyState, IconChip, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { timeAgo, cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };

const TONE: Record<string, "azure" | "green" | "orange" | "violet" | "red"> = { payment: "green", assessment: "orange", result: "violet", certificate: "orange", session: "azure", announcement: "azure", submission: "violet" };

export default async function Notifications() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Announcements, class reminders, deadlines and results."
        actions={items.some((n) => !n.readAt) && <form action={markAllRead}><SubmitButton variant="secondary"><CheckCheck className="size-4" /> Mark all read</SubmitButton></form>}
      />
      <Card>
        {items.length === 0 && <EmptyState icon={<Bell className="size-5" />} title="You’re all caught up" />}
        <ul className="divide-y divide-[#eef1f6]">
          {items.map((n) => (
            <li key={n.id}>
              <form action={openNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button className={cn("flex w-full gap-4 px-5 py-4 text-left transition hover:bg-azure-50/40", !n.readAt && "bg-azure-50/30")}>
                  <IconChip tone={TONE[n.type] ?? "slate"}><Bell /></IconChip>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-navy-950">{n.title}</span>
                      {!n.readAt && <span className="size-1.5 rounded-full bg-azure-500" />}
                    </div>
                    <p className="text-sm text-muted-600">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-500">{timeAgo(n.createdAt)}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
