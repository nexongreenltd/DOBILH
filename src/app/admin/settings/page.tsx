import { ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Checkbox, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { paymentMode } from "@/lib/payments";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requireAdmin();
  const s = await getSettings();
  if (user.role !== "SUPER_ADMIN") {
    return <Card><EmptyState icon={<ShieldAlert className="size-5" />} title="Super Admin only" description="Platform settings and access policies can only be changed by a Super Admin." /></Card>;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Platform settings" description="Governance and configuration. Changes are recorded in the audit log." />
      <ActionForm action={saveSettings} className="space-y-6">
        <Card>
          <CardHeader title="General" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Platform name" className="sm:col-span-2"><Input name="siteName" defaultValue={s.siteName} /></Field>
            <Field label="Support email"><Input name="supportEmail" type="email" defaultValue={s.supportEmail} /></Field>
            <Field label="Support phone"><Input name="supportPhone" defaultValue={s.supportPhone} /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Access" />
          <div className="space-y-3 p-5">
            <Checkbox name="allowSelfRegistration" defaultChecked={s.allowSelfRegistration} label="Allow learners to create their own accounts" />
          </div>
        </Card>
        <Card>
          <CardHeader title="AI assistant" />
          <div className="space-y-3 p-5">
            <Checkbox name="aiEnabled" defaultChecked={s.aiEnabled} label="Enable the student AI assistant" />
            <Checkbox name="aiGenerative" defaultChecked={s.aiGenerative} label="Use Claude for generative answers (requires ANTHROPIC_API_KEY); otherwise curated answers only" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payments" description={paymentMode() === "manual" ? "Payments are confirmed by staff in Admin → Payments until the PayPlus integration is connected." : "Sandbox mode — test payments only. Never use in production."} />
          <div className="p-5">
            <Field label="Instructions shown to learners on the payment page"><Textarea name="paymentInstructions" rows={3} defaultValue={s.paymentInstructions} /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Live classes (DoB Live)" description="Policy for in-app live classes, automatic attendance and replays." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Instructor can open the studio (min before start)"><Input name="liveHostEarlyMinutes" type="number" min={0} max={240} defaultValue={s.liveHostEarlyMinutes} /></Field>
            <Field label="Learners can enter the waiting room (min before start)"><Input name="liveJoinEarlyMinutes" type="number" min={0} max={120} defaultValue={s.liveJoinEarlyMinutes} /></Field>
            <Field label="Present if watched at least (% of the class)"><Input name="livePresentPercent" type="number" min={1} max={100} defaultValue={s.livePresentPercent} /></Field>
            <Field label="Marked late if joining after (min from go-live)"><Input name="liveLateAfterMinutes" type="number" min={0} max={120} defaultValue={s.liveLateAfterMinutes} /></Field>
            <Field label="Replays available for (days after the class)" hint="0 = for as long as the learner is enrolled"><Input name="replayRetentionDays" type="number" min={0} max={3650} defaultValue={s.replayRetentionDays} /></Field>
            <Field label="Who can watch replays">
              <Select name="replayScope" defaultValue={s.replayScope}>
                <option value="BATCH">Learners of the class’s batch</option>
                <option value="COURSE">Every learner enrolled in the course</option>
              </Select>
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <Checkbox name="liveRecordingEnabled" defaultChecked={s.liveRecordingEnabled} label="Record live classes and auto-publish the replay to the course" />
              <Checkbox name="liveChatEnabled" defaultChecked={s.liveChatEnabled} label="Enable chat and Q&A during live classes" />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Certificates" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Signatory name"><Input name="certificateSignatory" defaultValue={s.certificateSignatory} /></Field>
            <Field label="Signatory title"><Input name="certificateSignatoryTitle" defaultValue={s.certificateSignatoryTitle} /></Field>
          </div>
        </Card>
        <SubmitButton size="lg">Save settings</SubmitButton>
      </ActionForm>
    </div>
  );
}
