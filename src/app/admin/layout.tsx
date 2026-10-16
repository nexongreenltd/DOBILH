import { Shell } from "@/components/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Shell area="admin">{children}</Shell>;
}
