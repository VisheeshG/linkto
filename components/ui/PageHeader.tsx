import type { ReactNode } from "react";
import { cn } from "./cn";

/** Page title block: title (+ inline meta), description and actions. */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6",
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 break-words min-w-0">
              {title}
            </h1>
            {meta}
          </div>
          {description && <div className="mt-1 text-sm sm:text-base text-slate-600">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
