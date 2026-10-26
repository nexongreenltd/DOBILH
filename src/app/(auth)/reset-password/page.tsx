import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { resetPassword } from "@/app/actions/auth";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Link missing</h1>
        <p className="mt-2 text-sm text-slate-500">Open the link from your email again, or request a new one.</p>
        <Link href="/forgot-password" className="mt-6 inline-block font-medium text-lilac-500 hover:underline">Request a new link</Link>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Choose a new password</h1>
      <p className="mt-2 text-sm text-slate-500">At least 8 characters. You’ll be signed out everywhere else.</p>
      <ActionForm action={resetPassword} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New password">
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm new password">
          <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Saving…">
          Save new password
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
