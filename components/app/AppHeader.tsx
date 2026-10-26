"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { DropdownMenu } from "@/components/ui";
import { useRouter } from "next/navigation";

export type Crumb = { label: string; href?: string; onClick?: () => void };

/**
 * Persistent top bar for signed-in pages: logo (→ dashboard), breadcrumb
 * trail, and an account menu. On phones the trail collapses to a single
 * "‹ Parent" link so the bar stays one line.
 */
export function AppHeader({ crumbs = [] }: { crumbs?: Crumb[] }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const parent = [...crumbs].slice(0, -1).reverse().find((c) => c.href || c.onClick);
  const email = user?.email ?? "";
  const initial = (user?.user_metadata?.full_name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print-hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-8">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg"
          aria-label="Linkto dashboard"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 p-1">
            <BrandLogo size={32} priority className="h-6 w-6" />
          </span>
          <span className="hidden text-base font-bold tracking-tight text-slate-900 sm:inline">
            Linkto
          </span>
        </Link>

        {crumbs.length > 0 && (
          <>
            {/* Phones: one back link to the nearest parent. */}
            {parent &&
              (parent.onClick ? (
                <button
                  type="button"
                  onClick={parent.onClick}
                  className="flex min-w-0 items-center gap-1 text-sm font-medium text-slate-700 hover:text-primary-700 sm:hidden"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{parent.label}</span>
                </button>
              ) : (
                <Link
                  href={parent.href!}
                  className="flex min-w-0 items-center gap-1 text-sm font-medium text-slate-700 hover:text-primary-700 sm:hidden"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{parent.label}</span>
                </Link>
              ))}
            {/* Tablet/desktop: full trail. */}
            <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
              <ol className="flex min-w-0 items-center gap-1 text-sm">
                {crumbs.map((crumb, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      {crumb.onClick && !last ? (
                        <button
                          type="button"
                          onClick={crumb.onClick}
                          className="truncate rounded px-1 text-slate-600 hover:text-primary-700"
                        >
                          {crumb.label}
                        </button>
                      ) : crumb.href && !last ? (
                        <Link
                          href={crumb.href}
                          className="truncate rounded px-1 text-slate-600 hover:text-primary-700"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span
                          aria-current={last ? "page" : undefined}
                          className="truncate px-1 font-medium text-slate-900 max-w-[16rem]"
                        >
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </>
        )}

        <div className="ml-auto shrink-0">
          <DropdownMenu
            label="Account"
            items={[
              {
                label: "Dashboard",
                icon: LayoutDashboard,
                onSelect: () => router.push("/dashboard"),
              },
              {
                label: "Sign out",
                description: email,
                icon: LogOut,
                tone: "danger",
                onSelect: () => void signOut(),
              },
            ]}
            trigger={(props) => (
              <button
                {...props}
                type="button"
                aria-label={`Account menu for ${email}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700"
              >
                {initial || <UserRound className="h-4 w-4" aria-hidden />}
              </button>
            )}
          />
        </div>
      </div>
    </header>
  );
}
