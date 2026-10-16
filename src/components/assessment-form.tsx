import { createAssessment } from "@/app/actions/instructor";
import { ActionForm, SubmitButton } from "./forms";
import { Field, Input, Select, Textarea } from "./ui";

export function NewAssessmentForm({ courses }: { courses: { id: string; title: string; batches: { id: string; name: string }[] }[] }) {
  return (
    <ActionForm action={createAssessment} className="grid gap-4 sm:grid-cols-2">
      <Field label="Course">
        <Select name="courseId" required>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      </Field>
      <Field label="Applies to batch" hint="Leave as all batches for course-wide assessments">
        <Select name="batchId" defaultValue="">
          <option value="">All batches</option>
          {courses.flatMap((c) => c.batches.map((b) => <option key={b.id} value={b.id}>{c.title} — {b.name}</option>))}
        </Select>
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue="QUIZ">
          <option value="QUIZ">Quiz (auto-graded)</option>
          <option value="ASSIGNMENT">Assignment</option>
          <option value="CLASS_TEST">Class test</option>
          <option value="EXAM">Exam</option>
        </Select>
      </Field>
      <Field label="Title"><Input name="title" required placeholder="e.g. Quiz 3: APIs" /></Field>
      <Field label="Total marks"><Input name="totalMarks" type="number" defaultValue={10} min={1} /></Field>
      <Field label="Pass marks"><Input name="passMarks" type="number" defaultValue={6} min={0} /></Field>
      <Field label="Due (Dhaka time)"><Input name="dueAt" type="datetime-local" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time limit (min)" hint="0 = untimed"><Input name="durationMin" type="number" defaultValue={0} min={0} /></Field>
        <Field label="Attempts"><Input name="maxAttempts" type="number" defaultValue={1} min={1} max={10} /></Field>
      </div>
      <Field label="Instructions" className="sm:col-span-2"><Textarea name="instructions" rows={3} /></Field>
      <div className="sm:col-span-2"><SubmitButton>Create &amp; add questions</SubmitButton></div>
    </ActionForm>
  );
}
