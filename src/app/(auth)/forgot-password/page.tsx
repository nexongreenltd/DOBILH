import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { requestPasswordReset } from "@/app/actions/auth";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Forgot your password?</h1>
      <p className="mt-2 text-sm text-slate-500">Enter your account email and we’ll send you a link to choose a new one.</p>
      <ActionForm action={requestPasswordReset} className="mt-8 space-y-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Sending…">
          Send reset link
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-lilac-500 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
