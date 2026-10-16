import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { register } from "@/app/actions/auth";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Create your account</h1>
      <p className="mt-2 text-sm text-slate-500">Join thousands of learners at DoB Innovation &amp; Learning Hub.</p>
      <ActionForm action={register} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Full name">
          <Input name="name" required autoComplete="name" placeholder="Your name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Field label="Mobile number" hint="Optional — for class reminders">
          <Input name="phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Creating account…">
          Create account
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-lilac-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
