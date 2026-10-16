import { Bot, Power, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveKnowledge, deleteKnowledge, dismissReview, toggleAi } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, Disclosure, EmptyState, Field, Input, PageHeader, Select, StatCard, Tabs, Textarea } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "AI assistant" };

export default async function AdminAi({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab = "review" } = await searchParams;
  const settings = await getSettings();
  const [knowledge, review, courses, totalQs, unanswered] = await Promise.all([
    db.aiKnowledge.findMany({ include: { course: true }, orderBy: [{ hits: "desc" }, { createdAt: "desc" }] }),
    db.aiMessage.findMany({ where: { needsReview: true, reviewedAt: null }, include: { conversation: { include: { user: true, course: true, messages: { orderBy: { createdAt: "asc" } } } } }, orderBy: { createdAt: "desc" } }),
    db.course.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.aiMessage.count({ where: { role: "USER" } }),
    db.aiMessage.count({ where: { needsReview: true } }),
  ]);
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

  const knowledgeForm = (k?: (typeof knowledge)[number], prefill?: { question: string; messageId: string; courseId: string | null }) => (
    <ActionForm action={saveKnowledge} className="grid gap-3 sm:grid-cols-2" resetOnSuccess={!k}>
      {k && <input type="hidden" name="id" value={k.id} />}
      {prefill && <input type="hidden" name="fromMessageId" value={prefill.messageId} />}
      <Field label="Question" className="sm:col-span-2"><Input name="question" defaultValue={k?.question ?? prefill?.question} required /></Field>
      <Field label="Answer" className="sm:col-span-2"><Textarea name="answer" rows={3} defaultValue={k?.answer} required /></Field>
      <Field label="Keywords (comma-separated)"><Input name="keywords" defaultValue={k?.keywords.join(", ")} placeholder="refund, money back" /></Field>
      <Field label="Scope">
        <Select name="courseId" defaultValue={k?.courseId ?? prefill?.courseId ?? ""}><option value="">Platform-wide</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
      </Field>
      <Field label="Status"><Select name="status" defaultValue={k?.status ?? "ACTIVE"}><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option></Select></Field>
      <div className="flex items-end"><SubmitButton>{k ? "Save" : "Add to knowledge"}</SubmitButton></div>
    </ActionForm>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="AI assistant" description="Curated knowledge, unanswered-question review and controls." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Knowledge entries" value={knowledge.length} icon={<Bot />} accent="sky" />
        <StatCard label="Questions asked" value={totalQs} icon={<Sparkles />} accent="violet" />
        <StatCard label="Answer rate" value={totalQs ? `${Math.round(((totalQs - unanswered) / totalQs) * 100)}%` : "—"} accent="brand" />
        <Card className="space-y-2 p-4">
          <div className="text-[13px] text-muted-500">Controls</div>
          <form action={toggleAi} className="flex items-center justify-between gap-2">
            <input type="hidden" name="key" value="aiEnabled" /><input type="hidden" name="value" value={String(!settings.aiEnabled)} />
            <span className="text-sm text-navy-950">Assistant</span>
            <SubmitButton size="sm" variant={settings.aiEnabled ? "brand" : "secondary"}><Power className="size-3.5" /> {settings.aiEnabled ? "On" : "Off"}</SubmitButton>
          </form>
          <form action={toggleAi} className="flex items-center justify-between gap-2">
            <input type="hidden" name="key" value="aiGenerative" /><input type="hidden" name="value" value={String(!settings.aiGenerative)} />
            <span className="text-sm text-navy-950">Generative (Claude)</span>
            <SubmitButton size="sm" variant={settings.aiGenerative ? "brand" : "secondary"}>{settings.aiGenerative ? "On" : "Off"}</SubmitButton>
          </form>
        </Card>
      </div>
      {settings.aiGenerative && !hasKey && <Alert tone="amber">Generative answers are on, but no <code>ANTHROPIC_API_KEY</code> is configured — the assistant is answering from curated knowledge only.</Alert>}
      <Tabs active={tab} tabs={[{ key: "review", label: `Review queue (${review.length})`, href: "?tab=review" }, { key: "knowledge", label: `Knowledge (${knowledge.length})`, href: "?tab=knowledge" }]} />
      {tab === "review" ? (
        <div className="space-y-3">
          {review.length === 0 && <Card><EmptyState icon={<Bot className="size-5" />} title="No unanswered questions" description="Questions the assistant couldn’t answer will appear here." /></Card>}
          {review.map((m) => {
            const idx = m.conversation.messages.findIndex((x) => x.id === m.id);
            const q = m.conversation.messages.slice(0, idx).reverse().find((x) => x.role === "USER");
            return (
              <Card key={m.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-500">{m.conversation.user.name} · {m.conversation.course?.title ?? "General"} · {timeAgo(m.createdAt)}</div>
                <div className="mt-1 font-medium text-navy-950">“{q?.content}”</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <Disclosure summary="Answer & add to knowledge">{knowledgeForm(undefined, { question: q?.content ?? "", messageId: m.id, courseId: m.conversation.courseId })}</Disclosure>
                  <form action={dismissReview}><input type="hidden" name="id" value={m.id} /><SubmitButton variant="ghost">Dismiss</SubmitButton></form>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <Disclosure summary="Add a knowledge entry">{knowledgeForm()}</Disclosure>
          {knowledge.map((k) => (
            <Card key={k.id} className="p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={k.courseId ? "blue" : "violet"}>{k.course?.title ?? "Platform"}</Badge>{k.status === "DRAFT" && <Badge>Draft</Badge>}<span className="text-xs text-muted-500">{k.hits} uses</span></div>
                  <div className="mt-2 font-medium text-navy-950">{k.question}</div>
                  <p className="mt-1 text-sm text-muted-600">{k.answer}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{k.keywords.map((w) => <span key={w} className="rounded-md bg-azure-50 px-1.5 py-0.5 text-[11px] text-azure-500">{w}</span>)}</div>
                </div>
                <form action={deleteKnowledge}><input type="hidden" name="id" value={k.id} /><SubmitButton variant="ghost" size="sm" confirm="Delete this entry?">Delete</SubmitButton></form>
              </div>
              <div className="mt-3"><Disclosure summary="Edit">{knowledgeForm(k)}</Disclosure></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
