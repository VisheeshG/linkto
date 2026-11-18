import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { siteConfig } from "@/lib/site-config";

export const CONTACT_EMAIL = "hello@linkto.in";

/** Frame for the Privacy and Terms pages: quiet header, readable column. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label={`${siteConfig.name} home`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 p-1">
              <BrandLogo size={32} priority className="h-6 w-6" />
            </span>
            <span className="text-base font-bold tracking-tight">{siteConfig.name}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-sm font-medium text-slate-700">
            <Link href="/privacy" className="hover:text-primary-700">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-primary-700">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">Last updated {updated}</p>
        <p className="mt-4 text-base text-slate-700">{intro}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-600">
        {siteConfig.name} · Questions?{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary-700 hover:underline">
          {CONTACT_EMAIL}
        </a>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
