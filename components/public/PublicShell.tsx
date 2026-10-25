"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui";
import { siteConfig } from "@/lib/site-config";

/**
 * Frame for pages a brand shares with its clients: a quiet top bar, the
 * content, and a small "Powered by" footer. No account controls.
 */
export function PublicShell({
  children,
  printable = false,
}: {
  children: ReactNode;
  /** Show a "Print / Save PDF" button in the bar. */
  printable?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white print-hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 lg:px-8">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 p-1">
            <BrandLogo size={32} priority className="h-6 w-6" />
          </span>
          <span className="text-sm font-semibold text-slate-900">{siteConfig.name}</span>
          <span className="hidden text-sm text-slate-600 sm:inline">· Shared report</span>
          {printable && (
            <div className="ml-auto">
              <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
                <span className="hidden sm:inline">Print / Save PDF</span>
                <span className="sm:hidden">Print</span>
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8 lg:px-8">{children}</main>
      <footer className="py-6 text-center text-xs text-slate-600">
        Powered by{" "}
        <a href={siteConfig.url} className="font-medium text-slate-700 hover:text-primary-700">
          {siteConfig.name}
        </a>
      </footer>
    </div>
  );
}
