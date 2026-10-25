"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

const CONTROL =
  "w-full rounded-lg border bg-white px-3 text-[15px] sm:text-sm text-slate-900 placeholder:text-slate-500 shadow-sm transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50 disabled:text-slate-500 read-only:bg-slate-50";

type ControlExtras = { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ControlExtras>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(CONTROL, "h-10", invalid ? "border-rose-400" : "border-slate-300", className)}
        {...rest}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras
>(function Textarea({ className, invalid, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, "py-2 resize-y", invalid ? "border-rose-400" : "border-slate-300", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & ControlExtras
>(function Select({ className, invalid, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, "h-10 pr-8 truncate", invalid ? "border-rose-400" : "border-slate-300", className)}
      {...rest}
    />
  );
});

/**
 * Label + control + hint/error, wired together for assistive tech
 * (htmlFor/id, aria-describedby, aria-invalid). Pass exactly one control.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; invalid?: boolean }>;
  className?: string;
}) {
  const autoId = useId();
  const controlId = (isValidElement(children) && children.props.id) || autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={controlId} className="block text-sm font-medium text-slate-800 mb-1.5">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-500">(optional)</span>}
      </label>
      {cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        invalid: Boolean(error) || children.props.invalid,
      })}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Checkbox with a title and optional description, full row clickable. */
export function CheckboxField({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-primary-600 accent-primary-600"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-slate-800">
          {title}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-xs text-slate-600 mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
