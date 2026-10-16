"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { FormAction } from "@/lib/action";
import { buttonClass, type ButtonVariant } from "./ui";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText,
  name,
  value,
  confirm,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={buttonClass({ variant, size }, className)}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Form bound to a server action returning ActionResult; shows inline success/error. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p className="mt-3 flex items-center gap-2 text-sm text-brand-700">
          <CheckCircle2 className="size-4 shrink-0" /> {state.message}
        </p>
      )}
    </form>
  );
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
