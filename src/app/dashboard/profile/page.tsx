import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/rbac";
import { updateProfile, changePassword } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, CardHeader, Field, Input, PageHeader, Textarea, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile" />
      <Card className="flex items-center gap-5 p-6">
        <Avatar name={user.name} color={user.avatarColor} size={64} />
        <div>
          <div className="font-display text-xl font-semibold text-navy-950">{user.name}</div>
          <div className="text-sm text-muted-600">{user.email}</div>
          <div className="mt-2 flex gap-2"><Badge tone="blue">{ROLE_LABEL[user.role]}</Badge><Badge>Member since {formatDate(user.createdAt)}</Badge></div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Personal details" />
        <ActionForm action={updateProfile} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name"><Input name="name" defaultValue={user.name} required /></Field>
          <Field label="Mobile number"><Input name="phone" defaultValue={user.phone ?? ""} /></Field>
          <Field label="Headline" className="sm:col-span-2"><Input name="headline" defaultValue={user.headline ?? ""} placeholder="e.g. Aspiring data analyst" /></Field>
          <Field label="Bio" className="sm:col-span-2"><Textarea name="bio" defaultValue={user.bio ?? ""} /></Field>
          <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card>
        <CardHeader title="Change password" />
        <ActionForm action={changePassword} className="grid gap-4 p-5 sm:grid-cols-2" resetOnSuccess>
          <Field label="Current password"><Input name="current" type="password" required autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 8 characters"><Input name="next" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <div className="sm:col-span-2"><SubmitButton variant="secondary">Update password</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
