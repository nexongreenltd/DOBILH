import Link from "next/link";
import { Mail, MapPin, Phone, ArrowRight } from "lucide-react";
import { Logo } from "../logo";

const COLUMNS = [
  { title: "Learn", links: [["/courses", "All courses"], ["/courses?mode=ONLINE", "Online"], ["/courses?mode=OFFLINE", "Offline"], ["/courses?price=free", "Free courses"]] },
  { title: "Platform", links: [["/dashboard", "Student dashboard"], ["/instructor", "Instructor workspace"], ["/verify", "Verify a certificate"], ["/register", "Create account"]] },
  { title: "Company", links: [["/#mission", "About DoB"], ["/#how", "How it works"], ["/#faq", "FAQ"], ["/#programs", "Programmes"]] },
];

/** reflect.app footer, light: brand + link columns, then a closing row. */
export function SiteFooter({ supportEmail, supportPhone }: { supportEmail: string; supportPhone: string }) {
  return (
    <footer className="relative bg-paper">
      <div className="rf-hairline-x" />
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col justify-between gap-12 py-20 lg:flex-row">
          <div className="flex flex-col justify-between gap-8">
            <Logo />
            <ul className="space-y-2.5 text-sm text-ink-soft">
              <li className="flex items-center gap-2.5"><MapPin className="size-4 text-ink-faint" /> House 12, Road 7, Dhanmondi, Dhaka 1205</li>
              <li className="flex items-center gap-2.5"><Mail className="size-4 text-ink-faint" /> <a href={`mailto:${supportEmail}`} className="hover:text-ink">{supportEmail}</a></li>
              <li className="flex items-center gap-2.5"><Phone className="size-4 text-ink-faint" /> {supportPhone}</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((c) => (
              <div key={c.title} className="min-w-[160px]">
                <div className="text-sm font-medium text-ink">{c.title}</div>
                <ul className="mt-5 space-y-4">
                  {c.links.map(([href, label]) => (
                    <li key={href}><Link href={href} className="text-sm text-ink-soft transition-colors duration-[450ms] ease-[cubic-bezier(.6,.6,0,1)] hover:text-ink">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="rf-hairline-x" />
        <div className="flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center">
          <div>
            <div className="rf-title font-display text-2xl font-medium">Start learning with DoB</div>
            <p className="mt-1 text-sm text-ink-soft">Free account · enroll when you’re ready.</p>
          </div>
          <Link href="/register" className="rf-btn rf-btn-primary">Create account <ArrowRight className="size-4" /></Link>
        </div>
        <div className="flex flex-col justify-between gap-3 pb-12 text-xs text-ink-faint sm:flex-row">
          <span>© {new Date().getFullYear()} Dreams of Bangladesh. All rights reserved.</span>
          <span className="flex gap-6"><Link href="/#faq" className="hover:text-ink">Privacy</Link><Link href="/#faq" className="hover:text-ink">Terms</Link><Link href="/#faq" className="hover:text-ink">Refund policy</Link></span>
        </div>
      </div>
    </footer>
  );
}
