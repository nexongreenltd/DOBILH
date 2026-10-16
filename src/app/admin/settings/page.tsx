import { ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Checkbox, EmptyState, Field, Input, PageHeader } from "@/components/ui";

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
