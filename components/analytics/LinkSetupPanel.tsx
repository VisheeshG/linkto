"use client";

import { Link2, Settings2 } from "lucide-react";
import { Badge, Card, CardHeader, CopyButton } from "@/components/ui";
import type { Link } from "@/lib/supabase";
import { TrackingQrCode } from "@/components/TrackingQrCode";

/** How to share this link (URL format, QR) and its current settings. */
export function LinkSetupPanel({
  link,
  trackingUrlTemplate,
  exampleUrl,
  showQr,
  qrProps,
}: {
  link: Link;
  trackingUrlTemplate: string;
  exampleUrl: string;
  showQr: boolean;
  qrProps: React.ComponentProps<typeof TrackingQrCode> | null;
}) {
  const expired = link.expires_at ? new Date(link.expires_at) <= new Date() : false;
  const settings: { label: string; value: React.ReactNode }[] = [
    {
      label: "Destination",
      value: (
        <a
          href={link.destination_url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary-700 hover:underline"
        >
          {link.destination_url}
        </a>
      ),
    },
    { label: "Platform", value: link.platform },
    {
      label: "Submission in URL",
      value: link.include_submission_in_url ? "Yes (…/creator/sub1)" : "No",
    },
    { label: "Open in app on phones", value: link.open_app_on_mobile ? "On" : "Off" },
    { label: "UTM tags", value: link.utm_enabled ? "Added automatically" : "Off" },
    {
      label: "Expiry",
      value: link.expires_at ? (
        <span className="inline-flex items-center gap-2">
          {new Date(link.expires_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          {expired && <Badge tone="danger">Expired</Badge>}
        </span>
      ) : (
        "Never"
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Tracking URL"
          description="Replace [creator] with each creator's name before sharing."
          icon={Link2}
        />
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Format</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800" title={trackingUrlTemplate}>
                {trackingUrlTemplate}
              </code>
              <CopyButton text={trackingUrlTemplate} iconOnly label="Copy URL format" />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Example</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-primary-700" title={exampleUrl}>
                {exampleUrl}
              </code>
              <CopyButton text={exampleUrl} iconOnly label="Copy example URL" />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Link settings" icon={Settings2} />
        <dl className="divide-y divide-slate-100 text-sm">
          {settings.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-slate-600 sm:w-44">{row.label}</dt>
              <dd className="min-w-0 font-medium text-slate-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {showQr && qrProps && (
        <div className="lg:col-span-2">
          <TrackingQrCode {...qrProps} />
        </div>
      )}
    </div>
  );
}
