import { createSession } from "@/app/actions/instructor";
import { ActionForm, SubmitButton } from "./forms";
import { Field, Input, Select } from "./ui";

export function SessionForm({ batches, lessons }: { batches: { id: string; name: string; mode: string; venue: string | null }[]; lessons: { id: string; orderNo: number; title: string }[] }) {
  return (
    <ActionForm action={createSession} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
      <Field label="Batch">
        <Select name="batchId" required>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="Linked lesson">
        <Select name="lessonId" defaultValue="">
          <option value="">— none —</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.orderNo}. {l.title}</option>)}
        </Select>
      </Field>
      <Field label="Title" className="sm:col-span-2"><Input name="title" required placeholder="e.g. Class 9: Deployment" /></Field>
      <Field label="Starts at (Dhaka time)"><Input name="startsAt" type="datetime-local" required /></Field>
      <Field label="Duration (min)"><Input name="durationMin" type="number" defaultValue={120} min={15} /></Field>
      <Field label="Mode">
        <Select name="mode" defaultValue="ONLINE">
          <option value="ONLINE">Online (live link)</option>
          <option value="OFFLINE">Offline (venue)</option>
        </Select>
      </Field>
      <Field label="Live link (online)"><Input name="liveUrl" placeholder="https://meet.google.com/…" /></Field>
      <Field label="Venue / room (offline)" className="sm:col-span-2"><Input name="venue" placeholder={batches[0]?.venue ?? "Room 3, DoB Innovation Lab"} /></Field>
      <div className="sm:col-span-2"><SubmitButton>Schedule & notify learners</SubmitButton></div>
    </ActionForm>
  );
}

