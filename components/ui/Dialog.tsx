"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row (e.g. Cancel / Save). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Prevent closing via Escape/backdrop (e.g. while saving). */
  dismissible?: boolean;
};

const SIZE = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };

/**
 * Modal dialog on the native <dialog> element: focus is trapped, Escape
 * closes, and focus returns to the opener. Bottom sheet on phones.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) {
      document.body.style.overflow = "";
      opener.current?.focus?.();
    }
  }, [open]);

  useEffect(
    () => () => {
      document.body.style.overflow = "";
    },
    []
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        "ui-dialog p-0 bg-transparent text-slate-900",
        "m-0 mt-auto w-full max-w-full sm:m-auto",
        SIZE[size]
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col bg-white shadow-xl rounded-t-2xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 sm:px-6 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-sm text-slate-600">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                label="Close"
                onClick={onClose}
                className="-mr-2"
              />
            )}
          </div>
          <div className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-200 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
