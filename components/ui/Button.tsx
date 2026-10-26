"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-300",
  secondary:
    "bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 disabled:text-slate-400",
  ghost:
    "text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400",
  subtle:
    "bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200 disabled:text-primary-300",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

const ICON_ONLY_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-11 w-11",
};

/** Classes for a button look-alike (e.g. a Next.js <Link>). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed select-none",
    VARIANT[variant],
    iconOnly ? ICON_ONLY_SIZE[size] : SIZE[size],
    className
  );
}

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  /** Extra classes for the icon. */
  iconClassName?: string;
};

type WithLabel = BaseProps & { children: ReactNode; label?: never };
/** Icon-only buttons must name themselves for screen readers. */
type IconOnly = BaseProps & { children?: undefined; label: string; icon: LucideIcon };

export type ButtonProps = WithLabel | IconOnly;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon: Icon,
    iconClassName,
    className,
    children,
    label,
    disabled,
    type = "button",
    ...rest
  },
  ref
) {
  const iconOnly = children === undefined;
  const iconSize = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-label={iconOnly ? label : rest["aria-label"]}
      title={iconOnly ? label : rest.title}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, iconOnly, className })}
      {...rest}
    >
      {loading ? (
        <Loader2 className={cn(iconSize, "animate-spin")} aria-hidden />
      ) : Icon ? (
        <Icon className={cn(iconSize, iconClassName)} aria-hidden />
      ) : null}
      {children}
    </button>
  );
});
