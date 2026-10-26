"use client";

import { useState } from "react";
import { Briefcase, MoreHorizontal, Trash2 } from "lucide-react";
import { Brand } from "@/lib/supabase";
import { ConfirmDialog, DropdownMenu } from "@/components/ui";
import { formatNumber, formatRelative } from "@/lib/format";

export type BrandWithStats = Brand & {
  projectCount: number;
  linkCount: number;
  clickCount: number;
};

interface BrandListProps {
  brands: BrandWithStats[];
  onSelectBrand: (brand: Brand) => void;
  onDeleteBrand: (brandId: string) => void | Promise<void>;
}

export function BrandList({ brands, onSelectBrand, onDeleteBrand }: BrandListProps) {
  const [pendingDelete, setPendingDelete] = useState<BrandWithStats | null>(null);

  if (brands.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.id}>
            <article className="group relative flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 focus-within:border-violet-300 sm:p-5">
              <div className="flex items-start gap-3">
                <div aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-snug text-slate-900">
                    <button
                      type="button"
                      onClick={() => onSelectBrand(brand)}
                      className="text-left break-words hover:text-violet-700 after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none"
                    >
                      {brand.name}
                    </button>
                  </h3>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-600">/{brand.slug}</p>
                </div>
                <div className="relative z-20">
                  <DropdownMenu
                    label={`Actions for ${brand.name}`}
                    items={[
                      {
                        label: "Delete brand",
                        description: "Projects move to unbranded",
                        icon: Trash2,
                        tone: "danger",
                        onSelect: () => setPendingDelete(brand),
                      },
                    ]}
                    trigger={(props) => (
                      <button
                        {...props}
                        type="button"
                        aria-label={`More actions for ${brand.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  />
                </div>
              </div>

              {brand.description && (
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{brand.description}</p>
              )}

              <div aria-hidden className="min-h-4 flex-1" />
              <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                {[
                  { label: brand.projectCount === 1 ? "project" : "projects", value: brand.projectCount },
                  { label: brand.linkCount === 1 ? "link" : "links", value: brand.linkCount },
                  { label: brand.clickCount === 1 ? "click" : "clicks", value: brand.clickCount },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dd className="text-base font-semibold tabular-nums text-slate-900">{formatNumber(stat.value)}</dd>
                    <dt className="text-xs text-slate-600">{stat.label}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-slate-600">
                Edited {formatRelative(brand.updated_at || brand.created_at) ?? "—"}
              </p>
            </article>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await onDeleteBrand(pendingDelete.id);
        }}
        title="Delete this brand?"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> will be deleted. Its projects,
            links and click data are kept and move to <em>Unbranded</em>, but
            branded tracking URLs (/{pendingDelete?.slug}/…) stop working.
          </>
        }
        confirmLabel="Delete brand"
      />
    </>
  );
}
