import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { login } from "@/app/actions/auth";

export const metadata = { title: "Sign in" };

const DEMO = [
  ["Student", "student@dob.org"],
  ["Instructor", "arif@dob.org"],
  ["Admin", "admin@dob.org"],
  ["Super Admin", "superadmin@dob.org"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mt-2 text-sm text-slate-500">Sign in to continue learning.</p>
      <ActionForm action={login} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        New to DoB?{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-lilac-500 hover:underline">
          Create an account
        </Link>
      </p>
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Demo accounts · Password@123</div>
          <ul className="mt-2 space-y-1 text-sm">
            {DEMO.map(([role, email]) => (
              <li key={email} className="flex justify-between gap-2">
                <span className="text-slate-500">{role}</span>
                <code className="text-slate-800">{email}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
