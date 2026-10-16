import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, CheckCircle2, Circle, Paperclip, Target, CalendarClock, Users, BarChart3 } from "lucide-react";
import { db } from "@/lib/db";
import { assertCanManageCourse, requireStaffOrInstructor } from "@/lib/auth";
import { addQuestion, deleteQuestion, setAssessmentStatus, updateAssessment, gradeSubmission, deleteAssessment } from "@/app/actions/instructor";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Avatar, Badge, Card, CardHeader, Disclosure, EmptyState, Field, InfoTile, Input, Select, StatusBadge, Tabs, Textarea } from "@/components/ui";
import { formatDateTime, humanize, toLocalInput, cn } from "@/lib/utils";
import type { Answers } from "@/lib/grading";

export default async function AssessmentAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; error?: string; sub?: string }> }) {
  const user = await requireStaffOrInstructor();
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.assessment.findUnique({
    where: { id },
    include: {
      course: { include: { batches: { select: { id: true, name: true } } } },
      questions: { orderBy: { orderNo: "asc" }, include: { options: { orderBy: { orderNo: "asc" } } } },
      submissions: { where: { status: { not: "IN_PROGRESS" } }, include: { student: true, file: true }, orderBy: [{ status: "asc" }, { submittedAt: "desc" }] },
    },
  });
  if (!a) notFound();
  await assertCanManageCourse(user, a.courseId);
  const tab = sp.tab ?? (sp.sub ? "submissions" : a.questions.length || a.type !== "QUIZ" ? "submissions" : "questions");
  const graded = a.submissions.filter((s) => s.status === "GRADED");
  const avg = graded.length ? graded.reduce((s, x) => s + (x.obtained ?? 0), 0) / graded.length : null;
  const passRate = graded.length ? Math.round((graded.filter((g) => (g.obtained ?? 0) >= a.passMarks).length / graded.length) * 100) : null;
  const base = `/instructor/assessments/${a.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/instructor/assessments" className="text-[13px] text-muted-500 hover:text-navy-950">← Assessments</Link>
          <div className="mt-1 text-[13px] text-muted-500">{humanize(a.type)} · {a.course.title}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-navy-950 sm:text-[28px]">{a.title}</h1>
            <StatusBadge status={a.status} />
            {a.resultsPublished && <Badge tone="green">Results published</Badge>}
          </div>
        </div>
        <form action={setAssessmentStatus} className="flex flex-wrap gap-2">
          <input type="hidden" name="assessmentId" value={a.id} />
          {a.status === "DRAFT" && <SubmitButton name="action" value="publish">Publish to learners</SubmitButton>}
          {a.status === "PUBLISHED" && <SubmitButton name="action" value="close" variant="secondary">Close submissions</SubmitButton>}
          {a.status !== "DRAFT" && !a.resultsPublished && <SubmitButton name="action" value="release" variant="brand">Release results</SubmitButton>}
          {a.resultsPublished && <SubmitButton name="action" value="hide" variant="secondary">Hide results</SubmitButton>}
          {a.status === "CLOSED" && <SubmitButton name="action" value="publish" variant="secondary">Reopen</SubmitButton>}
        </form>
      </div>
      {sp.error === "no-questions" && <Alert tone="red">Add at least one question before publishing a quiz.</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoTile icon={<Target />} tone="azure" label="Total / pass" value={`${a.totalMarks} / ${a.passMarks}`} />
        <InfoTile icon={<CalendarClock />} tone="orange" label="Due" value={a.dueAt ? formatDateTime(a.dueAt) : "No deadline"} />
        <InfoTile icon={<Users />} tone="violet" label="Submissions" value={`${a.submissions.length} (${graded.length} graded)`} />
        <InfoTile icon={<BarChart3 />} tone="green" label="Average · pass rate" value={avg == null ? "—" : `${avg.toFixed(1)} · ${passRate}%`} />
      </div>

      <Tabs active={tab} tabs={[
        { key: "questions", label: `Questions (${a.questions.length})`, href: `${base}?tab=questions` },
        { key: "submissions", label: `Submissions (${a.submissions.length})`, href: `${base}?tab=submissions` },
        { key: "settings", label: "Settings", href: `${base}?tab=settings` },
      ]} />

      {tab === "questions" && (
        <div className="space-y-4">
          {a.questions.map((q, i) => (
            <Card key={q.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-500">Q{i + 1} · {humanize(q.type)} · {q.marks} mark{q.marks > 1 ? "s" : ""}</div>
                  <div className="font-medium text-navy-950">{q.prompt}</div>
                  <ul className="mt-2 space-y-1">
                    {q.options.map((o) => (
                      <li key={o.id} className={cn("flex items-center gap-2 text-sm", o.isCorrect ? "font-medium text-brand-700" : "text-muted-600")}>
                        {o.isCorrect ? <CheckCircle2 className="size-4" /> : <Circle className="size-4 text-slate-300" />} {o.text}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && <div className="mt-2 text-xs text-muted-500">Explanation: {q.explanation}</div>}
                </div>
                <form action={deleteQuestion}>
                  <input type="hidden" name="questionId" value={q.id} />
                  <SubmitButton variant="ghost" size="sm" confirm="Delete this question?"><Trash2 className="size-4" /></SubmitButton>
                </form>
              </div>
            </Card>
          ))}
          <Card>
            <CardHeader title="Add a question" description="For true/false, pick the answer below; for choice questions fill in options and tick the correct one(s)." />
            <ActionForm action={addQuestion} className="grid gap-4 p-5 sm:grid-cols-3" resetOnSuccess>
              <input type="hidden" name="assessmentId" value={a.id} />
              <Field label="Type">
                <Select name="type" defaultValue="SINGLE_CHOICE">
                  <option value="SINGLE_CHOICE">Single choice</option>
                  <option value="MULTI_CHOICE">Multiple choice</option>
                  <option value="TRUE_FALSE">True / false</option>
                  <option value="SHORT_ANSWER">Short answer (manual)</option>
                </Select>
              </Field>
              <Field label="Marks"><Input name="marks" type="number" defaultValue={2} min={1} /></Field>
              <Field label="True/false answer">
                <Select name="tf" defaultValue="true"><option value="true">True</option><option value="false">False</option></Select>
              </Field>
              <Field label="Question" className="sm:col-span-3"><Textarea name="prompt" rows={2} required /></Field>
              <div className="grid gap-2 sm:col-span-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="checkbox" name={`correct_${i}`} className="size-4 accent-azure-500" aria-label={`Option ${i + 1} correct`} />
                    <Input name={`opt_${i}`} placeholder={`Option ${i + 1}`} />
                  </div>
                ))}
              </div>
              <Field label="Explanation (shown after results)" className="sm:col-span-3"><Input name="explanation" /></Field>
              <div className="sm:col-span-3"><SubmitButton>Add question</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>
      )}

      {tab === "submissions" && (
        <Card>
          {a.submissions.length === 0 ? <EmptyState title="No submissions yet" /> : (
            <ul className="divide-y divide-[#eef1f6]">
              {a.submissions.map((s) => {
                const answers = (s.answers ?? {}) as Answers;
                const shorts = a.questions.filter((q) => q.type === "SHORT_ANSWER");
                return (
                  <li key={s.id} id={s.id} className={cn("p-5", sp.sub === s.id && "bg-azure-50/50")}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name={s.student.name} color={s.student.avatarColor} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy-950">{s.student.name}</div>
                        <div className="text-xs text-muted-500">Attempt {s.attemptNo} · {formatDateTime(s.submittedAt)}{s.autoScore != null ? ` · auto score ${s.autoScore}` : ""}</div>
                      </div>
                      <StatusBadge status={s.status} />
                      {s.obtained != null && <Badge tone={s.obtained >= a.passMarks ? "green" : "red"}>{s.obtained}/{a.totalMarks}</Badge>}
                    </div>
                    {s.textAnswer && <p className="mt-3 whitespace-pre-line rounded-xl bg-azure-50/60 p-3 text-sm text-navy-950">{s.textAnswer}</p>}
                    {s.file && <a href={`/api/files/${s.file.id}`} target="_blank" className="mt-2 inline-flex items-center gap-1 text-sm text-azure-500"><Paperclip className="size-3.5" /> {s.file.originalName}</a>}
                    {shorts.map((q) => (
                      <div key={q.id} className="mt-3 rounded-xl border border-[#e8ebf1] p-3 text-sm">
                        <div className="text-[11px] text-muted-500">{q.prompt} ({q.marks} marks)</div>
                        <div className="text-navy-950">{String(answers[q.id] ?? "—")}</div>
                      </div>
                    ))}
                    <ActionForm action={gradeSubmission} className="mt-3 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="submissionId" value={s.id} />
                      <label className="w-28"><span className="mb-1 block text-[11px] text-muted-500">Marks / {a.totalMarks}</span><Input name="obtained" type="number" step="0.5" min={0} max={a.totalMarks} defaultValue={s.obtained ?? s.autoScore ?? ""} required /></label>
                      <label className="min-w-64 flex-1"><span className="mb-1 block text-[11px] text-muted-500">Feedback</span><Input name="feedback" defaultValue={s.feedback ?? ""} placeholder="What went well, what to improve" /></label>
                      <SubmitButton variant={s.status === "GRADED" ? "secondary" : "primary"}>{s.status === "GRADED" ? "Update grade" : "Save grade"}</SubmitButton>
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Assessment settings" />
            <ActionForm action={updateAssessment} className="grid gap-4 p-5 sm:grid-cols-2">
              <input type="hidden" name="assessmentId" value={a.id} />
              <Field label="Title" className="sm:col-span-2"><Input name="title" defaultValue={a.title} /></Field>
              <Field label="Total marks"><Input name="totalMarks" type="number" defaultValue={a.totalMarks} /></Field>
              <Field label="Pass marks"><Input name="passMarks" type="number" defaultValue={a.passMarks} /></Field>
              <Field label="Due"><Input name="dueAt" type="datetime-local" defaultValue={toLocalInput(a.dueAt)} /></Field>
              <Field label="Batch">
                <Select name="batchId" defaultValue={a.batchId ?? ""}>
                  <option value="">All batches</option>
                  {a.course.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Time limit (min)"><Input name="durationMin" type="number" defaultValue={a.durationMin ?? 0} /></Field>
              <Field label="Attempts"><Input name="maxAttempts" type="number" defaultValue={a.maxAttempts} /></Field>
              <Field label="Instructions" className="sm:col-span-2"><Textarea name="instructions" defaultValue={a.instructions ?? ""} /></Field>
              <div className="sm:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
            </ActionForm>
          </Card>
          <Disclosure summary="Danger zone">
            <form action={deleteAssessment}>
              <input type="hidden" name="assessmentId" value={a.id} />
              <SubmitButton variant="danger" confirm="Delete this assessment and all submissions? This can't be undone.">Delete assessment</SubmitButton>
            </form>
          </Disclosure>
        </div>
      )}
    </div>
  );
}
