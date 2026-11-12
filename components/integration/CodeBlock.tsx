import { CopyButton } from "@/components/ui";

/** Copy-paste code sample: dark block, horizontal scroll, one Copy button. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-1.5">
        <span className="truncate text-xs font-medium text-slate-300">{label}</span>
        <CopyButton text={code} label="Copy" size="sm" variant="secondary" />
      </div>
      <pre
        tabIndex={0}
        role="region"
        aria-label={`${label} code`}
        className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-slate-100"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
