import Link from "next/link";
import { MessageSquare, Plus, Trash2, BotOff } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { deleteConversation } from "@/app/actions/student";
import { AssistantChat } from "@/components/assistant-chat";
import { Card, EmptyState } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "AI assistant" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; course?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  if (!settings.aiEnabled) {
    return <Card><EmptyState icon={<BotOff className="size-5" />} title="The assistant is turned off" description="Your administrators have temporarily disabled the AI assistant." /></Card>;
  }
  const [conversations, enrollments] = await Promise.all([
    db.aiConversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30, include: { course: { select: { title: true } } } }),
    db.enrollment.findMany({ where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } }, include: { course: { select: { id: true, title: true } } } }),
  ]);
  const current = sp.c ? await db.aiConversation.findFirst({ where: { id: sp.c, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="hidden space-y-2 lg:block">
        <Link href="/dashboard/assistant" className="flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-950 text-sm font-medium text-white hover:bg-navy-800">
          <Plus className="size-4" /> New chat
        </Link>
        <div className="space-y-1 pt-2">
          {conversations.map((c) => (
            <div key={c.id} className={cn("group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm", c.id === current?.id ? "bg-white shadow-sm ring-1 ring-[#e8ebf1]" : "hover:bg-white/70")}>
              <MessageSquare className="size-4 shrink-0 text-muted-500" />
              <Link href={`/dashboard/assistant?c=${c.id}`} className="min-w-0 flex-1">
                <div className="truncate text-navy-950">{c.title}</div>
                <div className="truncate text-[11px] text-muted-500">{c.course?.title ?? "General"} · {timeAgo(c.updatedAt)}</div>
              </Link>
              <form action={deleteConversation} className="opacity-0 group-hover:opacity-100">
                <input type="hidden" name="id" value={c.id} />
                <button className="rounded-md p-1 text-muted-500 hover:text-red-600" aria-label="Delete conversation"><Trash2 className="size-3.5" /></button>
              </form>
            </div>
          ))}
        </div>
      </div>
      <AssistantChat
        key={current?.id ?? "new"}
        conversationId={current?.id ?? null}
        courseId={sp.course ?? enrollments[0]?.courseId ?? null}
        courses={enrollments.map((e) => e.course)}
        messages={(current?.messages ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content, needsReview: m.needsReview }))}
        initialQuestion={!current ? sp.q : undefined}
        suggestions={["When is my next class?", "How do I get my certificate?", "What’s due this week?", "How is attendance counted?"]}
      />
    </div>
  );
}
