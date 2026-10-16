import { saveBatch } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "./forms";
import { Field, Input, Select } from "./ui";

type Batch = { id: string; courseId: string; name: string; mode: string; startDate: Date; endDate: Date; scheduleText: string | null; venue: string | null; capacity: number; status: string };

const d = (x?: Date) => (x ? new Date(x.getTime() + 6 * 3600000).toISOString().slice(0, 10) : "");

export function BatchForm({ courses, batch }: { courses: { id: string; title: string }[]; batch?: Batch }) {
  return (
    <ActionForm action={saveBatch} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" resetOnSuccess={!batch}>
      {batch && <input type="hidden" name="batchId" value={batch.id} />}
      <Field label="Course">
        <Select name="courseId" defaultValue={batch?.courseId} required>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      </Field>
      <Field label="Batch name"><Input name="name" defaultValue={batch?.name} required placeholder="Batch 05 — January 2027" /></Field>
      <Field label="Mode">
        <Select name="mode" defaultValue={batch?.mode ?? "ONLINE"}>
          <option value="ONLINE">Online</option><option value="OFFLINE">Offline</option><option value="HYBRID">Hybrid</option>
        </Select>
      </Field>
      <Field label="Start date"><Input name="startDate" type="date" defaultValue={d(batch?.startDate)} required /></Field>
      <Field label="End date"><Input name="endDate" type="date" defaultValue={d(batch?.endDate)} required /></Field>
      <Field label="Capacity"><Input name="capacity" type="number" min={1} defaultValue={batch?.capacity ?? 40} /></Field>
      <Field label="Schedule"><Input name="scheduleText" defaultValue={batch?.scheduleText ?? ""} placeholder="Sat & Tue, 7–9 PM" /></Field>
      <Field label="Venue (offline/hybrid)"><Input name="venue" defaultValue={batch?.venue ?? ""} /></Field>
      <Field label="Status">
        <Select name="status" defaultValue={batch?.status ?? "UPCOMING"}>
          <option value="UPCOMING">Upcoming</option><option value="RUNNING">Running</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
        </Select>
      </Field>
      <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>{batch ? "Save batch" : "Create batch"}</SubmitButton></div>
    </ActionForm>
  );
}
