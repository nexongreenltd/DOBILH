import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, Clock, Target, Repeat, CalendarClock, CheckCircle2, XCircle, FileText, Paperclip } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveEnrollment } from "@/lib/learning";
import { startAttempt, submitQuiz, submitAssignment } from "@/app/actions/student";
import { ActionForm, SubmitButton } from "@/components/forms";
import { QuizTimer } from "@/components/quiz-timer";
import { Alert, Badge, Card, CardHeader, Field, InfoTile, StatusBadge, Textarea } from "@/components/ui";
import { formatDateTime, humanize, cn } from "@/lib/utils";
import type { Answers } from "@/lib/grading";

type SP = { attempt?: string; done?: string; error?: string };

export default async function AssessmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.assessment.findUnique({
    where: { id },
    include: { course: true, questions: { orderBy: { orderNo: "asc" }, include: { options: { orderBy: { orderNo: "asc" } } } } },
  });
  if (!a || a.status === "DRAFT") notFound();
  const enrollment = await getActiveEnrollment(user.id, a.courseId);
  if (!enrollment || (a.batchId && a.batchId !== enrollment.batchId)) notFound();

  const submissions = await db.submission.findMany({ where: { assessmentId: a.id, studentId: user.id }, orderBy: { attemptNo: "desc" }, include: { file: true } });
  const now = new Date();
  const closed = a.status !== "PUBLISHED" || (a.dueAt != null && a.dueAt < now);
  const used = submissions.length;
  const objective = a.questions.length > 0;
  const inProgress = submissions.find((s) => s.status === "IN_PROGRESS");
  const running = sp.attempt && inProgress?.id === sp.attempt ? inProgress : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/dashboard/assessments" className="text-[13px] text-muted-500 hover:text-navy-950">← Assessments</Link>
        <div className="mt-1 text-[13px] text-muted-500">{humanize(a.type)} · {a.course.title}</div>
        <h1 className="font-display text-2xl font-semibold text-navy-950 sm:text-[28px]">{a.title}</h1>
      </div>

      {sp.done && <Alert tone="green">Submitted! {a.resultsPublished ? "Your result is below." : "Results will appear once your instructor publishes them."}</Alert>}
      {sp.error === "closed" && <Alert tone="red">This assessment is closed.</Alert>}
      {sp.error === "attempts" && <Alert tone="red">You’ve used all available attempts.</Alert>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoTile icon={<Target />} tone="azure" label="Total / pass marks" value={`${a.totalMarks} / ${a.passMarks}`} />
        <InfoTile icon={<CalendarClock />} tone="orange" label="Deadline" value={a.dueAt ? formatDateTime(a.dueAt) : "None"} />
        <InfoTile icon={<Clock />} tone="violet" label="Time limit" value={a.durationMin ? `${a.durationMin} min` : "Untimed"} />
        <InfoTile icon={<Repeat />} tone="green" label="Attempts" value={`${used} / ${a.maxAttempts}`} />
      </div>

      {running ? (
        <form id="quiz-form" action={submitQuiz} className="space-y-4">
          <input type="hidden" name="submissionId" value={running.id} />
          <div className="sticky top-16 z-10 flex items-center justify-between rounded-2xl border border-[#e8ebf1] bg-white/90 px-5 py-3 backdrop-blur">
            <span className="text-sm text-muted-600">Attempt {running.attemptNo} · {a.questions.length} questions</span>
            {a.durationMin && <QuizTimer endsAt={running.startedAt.getTime() + a.durationMin * 60000} formId="quiz-form" />}
          </div>
          {a.questions.map((q, i) => (
            <Card key={q.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="font-medium text-navy-950"><span className="text-muted-500">Q{i + 1}.</span> {q.prompt}</div>
                <Badge tone="blue">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
              </div>
              {q.type === "MULTI_CHOICE" && <div className="mt-1 text-xs text-muted-500">Select all that apply</div>}
              <div className="mt-4 space-y-2">
                {q.type === "SHORT_ANSWER" ? (
                  <Textarea name={`q_${q.id}`} placeholder="Your answer" />
                ) : (
                  q.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e8ebf1] px-4 py-3 text-sm transition hover:border-azure-200 has-[:checked]:border-azure-500 has-[:checked]:bg-azure-50">
                      <input type={q.type === "MULTI_CHOICE" ? "checkbox" : "radio"} name={`q_${q.id}`} value={o.id} className="size-4 accent-azure-500" />
                      {o.text}
                    </label>
                  ))
                )}
              </div>
            </Card>
          ))}
          <div className="flex justify-end">
            <SubmitButton size="lg" pendingText="Submitting…" confirm="Submit your answers? You can’t change them afterwards.">Submit answers</SubmitButton>
          </div>
        </form>
      ) : (
        <>
          {a.instructions && (
            <Card className="p-5">
              <div className="text-[13px] text-muted-500">Instructions</div>
              <p className="mt-1 whitespace-pre-line text-sm text-navy-950">{a.instructions}</p>
            </Card>
          )}

          {!closed && used < a.maxAttempts && (
            objective ? (
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="font-medium text-navy-950">{inProgress ? "You have an attempt in progress" : used ? "Ready for another attempt?" : "Ready to begin?"}</div>
                  <div className="text-sm text-muted-600">{a.questions.length} questions{a.durationMin ? ` · the timer starts when you begin` : ""}{a.maxAttempts > 1 ? " · best score counts" : ""}</div>
                </div>
                <form action={startAttempt}>
                  <input type="hidden" name="assessmentId" value={a.id} />
                  <SubmitButton size="lg">{inProgress ? "Resume attempt" : "Start attempt"}</SubmitButton>
                </form>
              </Card>
            ) : (
              <Card>
                <CardHeader title="Submit your work" description="Write your answer, attach a file (PDF, DOCX, ZIP, images — max 50 MB), or both." />
                <ActionForm action={submitAssignment} className="space-y-4 p-5" resetOnSuccess>
                  <input type="hidden" name="assessmentId" value={a.id} />
                  <Field label="Your answer"><Textarea name="textAnswer" rows={8} placeholder="Write your response here…" /></Field>
                  <Field label="Attachment"><input type="file" name="file" className="block w-full text-sm text-muted-600 file:mr-4 file:rounded-xl file:border-0 file:bg-azure-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-azure-500" /></Field>
                  <SubmitButton pendingText="Uploading…">Submit</SubmitButton>
                </ActionForm>
              </Card>
            )
          )}

          <Card>
            <CardHeader title="Your attempts" />
            {submissions.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-500">{closed ? "You didn’t submit this assessment." : "No attempts yet."}</div>
            ) : (
              <ul className="divide-y divide-[#eef1f6]">
                {submissions.map((s) => {
                  const showResult = s.status === "GRADED" && a.resultsPublished;
                  const answers = (s.answers ?? {}) as Answers;
                  return (
                    <li key={s.id} className="p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-navy-950">Attempt {s.attemptNo}</span>
                        <StatusBadge status={s.status} />
                        <span className="text-xs text-muted-500">{s.submittedAt ? `Submitted ${formatDateTime(s.submittedAt)}` : `Started ${formatDateTime(s.startedAt)}`}</span>
                        {showResult && (
                          <span className={cn("ml-auto font-display text-xl font-semibold", (s.obtained ?? 0) >= a.passMarks ? "text-brand-700" : "text-sun-600")}>
                            {s.obtained} / {a.totalMarks}
                          </span>
                        )}
                      </div>
                      {showResult && s.feedback && <div className="mt-3 rounded-xl bg-azure-50/70 p-3 text-sm text-navy-950"><span className="text-muted-500">Feedback: </span>{s.feedback}</div>}
                      {s.textAnswer && <p className="mt-3 line-clamp-3 text-sm text-muted-600"><FileText className="mr-1 inline size-3.5" />{s.textAnswer}</p>}
                      {s.file && <a href={`/api/files/${s.file.id}`} target="_blank" className="mt-2 inline-flex items-center gap-1 text-sm text-azure-500"><Paperclip className="size-3.5" /> {s.file.originalName}</a>}
                      {showResult && objective && Object.keys(answers).length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-azure-500">Review answers</summary>
                          <div className="mt-3 space-y-3">
                            {a.questions.map((q, i) => {
                              const chosen = new Set([answers[q.id]].flat().filter(Boolean) as string[]);
                              const correct = q.options.filter((o) => o.isCorrect);
                              const ok = q.type !== "SHORT_ANSWER" && correct.length === chosen.size && correct.every((o) => chosen.has(o.id));
                              return (
                                <div key={q.id} className="rounded-xl border border-[#e8ebf1] p-3 text-sm">
                                  <div className="flex items-start gap-2">
                                    {q.type === "SHORT_ANSWER" ? <ClipboardCheck className="mt-0.5 size-4 text-muted-500" /> : ok ? <CheckCircle2 className="mt-0.5 size-4 text-brand-600" /> : <XCircle className="mt-0.5 size-4 text-sun-500" />}
                                    <span className="font-medium text-navy-950">Q{i + 1}. {q.prompt}</span>
                                  </div>
                                  {q.type !== "SHORT_ANSWER" && <div className="mt-1 pl-6 text-muted-600">Correct: {correct.map((o) => o.text).join(", ")}</div>}
                                  {q.explanation && <div className="mt-1 pl-6 text-xs text-muted-500">{q.explanation}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
