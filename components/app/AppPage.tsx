"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { AppHeader, type Crumb } from "./AppHeader";
import { EmptyState, LoadingBlock, Skeleton, buttonClasses } from "@/components/ui";

/** Signed-in page frame: header + centered content column. */
export function AppPage({ crumbs, children }: { crumbs?: Crumb[]; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader crumbs={crumbs} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-8">{children}</main>
    </div>
  );
}

/** Skeleton shaped like a typical page (title, KPI row, list). */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-14 border-b border-slate-200 bg-white" />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-8">
        <LoadingBlock label={label}>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-80 max-w-full mb-8" />
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
            <Skeleton className="h-20 sm:h-24" />
            <Skeleton className="h-20 sm:h-24" />
            <Skeleton className="h-20 sm:h-24" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </LoadingBlock>
      </main>
    </div>
  );
}

export function PageNotFound({
  title,
  description,
  crumbs,
}: {
  title: string;
  description: ReactNode;
  crumbs?: Crumb[];
}) {
  return (
    <AppPage crumbs={crumbs}>
      <EmptyState
        icon={SearchX}
        title={title}
        description={description}
        action={
          <Link href="/dashboard" className={buttonClasses({ variant: "primary" })}>
            Back to dashboard
          </Link>
        }
        className="mt-6"
      />
    </AppPage>
  );
}
