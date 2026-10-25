"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";

/** Copies text and confirms right on the button ("Copied"). */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  iconOnly = false,
  variant = "secondary",
  size = "sm",
  className,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); leave state unchanged.
    }
  };

  if (iconOnly) {
    return (
      <Button
        variant={variant}
        size={size}
        icon={copied ? Check : Copy}
        iconClassName={copied ? "text-emerald-600" : undefined}
        label={copied ? copiedLabel : label}
        onClick={onClick}
        className={className}
      />
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      icon={copied ? Check : Copy}
      iconClassName={copied ? "text-emerald-600" : undefined}
      onClick={onClick}
      className={className}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
