import { ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function Forbidden() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50 text-sun-600">
        <ShieldAlert className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold">You don’t have access to this page</h1>
      <p className="max-w-md text-sm text-slate-500">Your role doesn’t include permission for this area. If you think this is a mistake, contact an administrator.</p>
      <LinkButton href="/">Back to home</LinkButton>
    </div>
  );
}
