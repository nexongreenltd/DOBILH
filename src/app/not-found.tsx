import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-display text-7xl font-bold text-brand-700">404</div>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-slate-500">The page you’re looking for doesn’t exist or has moved.</p>
      <LinkButton href="/" className="mt-2">Go home</LinkButton>
    </div>
  );
}
