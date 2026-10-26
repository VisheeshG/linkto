"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Link } from "@/lib/supabase";
import { buildTrackingUrlTemplate } from "@/lib/tracking-url";
import { formatCompact, formatNumber, formatRelative } from "@/lib/format";
import {
  Badge,
  Button,
  ConfirmDialog,
  CopyButton,
  DropdownMenu,
  Skeleton,
} from "@/components/ui";

interface LinkListProps {
  links: Link[];
  onSelectLink: (link: Link) => void;
  onDeleteLink: (linkId: string) => void | Promise<void>;
  onEditLink?: (link: Link) => void;
  projectSlug: string;
  brandSlug?: string | null;
  readOnly?: boolean;
  enableSelectInReadOnly?: boolean;
  /** Clicks per link id. Undefined while loading (shows a placeholder). */
  clickCounts?: Record<string, number>;
  /** Explains what the count includes, e.g. "Genuine clicks (bots hidden)". */
  clickCountTitle?: string;
}

/**
 * Links in a project. Each row opens the link's analytics (the title is a
 * real button stretched over the card); copy / edit / delete sit above it.
 */
export function LinkList({
  links,
  onSelectLink,
  onDeleteLink,
  onEditLink,
  projectSlug,
  brandSlug = null,
  readOnly = false,
  enableSelectInReadOnly = false,
  clickCounts,
  clickCountTitle = "Clicks",
}: LinkListProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Link | null>(null);
  const selectable = !readOnly || enableSelectInReadOnly;

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const urlForLink = (link: Link) =>
    buildTrackingUrlTemplate({
      baseUrl,
      brandSlug,
      projectSlug,
      shortCode: link.short_code,
      includeSubmissionInUrl: link.include_submission_in_url ?? false,
    });

  return (
    <>
      <ul className="space-y-3">
        {links.map((link) => {
          const count = clickCounts?.[link.id];
          const expired = link.expires_at ? new Date(link.expires_at) <= new Date() : false;
          const trackingUrl = baseUrl ? urlForLink(link) : "";
          const edited = formatRelative(link.updated_at || link.created_at);

          return (
            <li key={link.id}>
              <article
                className={`group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors sm:p-5 ${
                  selectable ? "hover:border-primary-300 focus-within:border-primary-300" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden
                    className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 sm:flex"
                  >
                    <Link2 className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
                      {selectable ? (
                        <button
                          type="button"
                          onClick={() => onSelectLink(link)}
                          className="text-left break-words hover:text-primary-700 after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none"
                        >
                          {link.link_title}
                        </button>
                      ) : (
                        <span className="break-words">{link.link_title}</span>
                      )}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge>{link.platform}</Badge>
                      {link.expires_at &&
                        (expired ? (
                          <Badge tone="danger">Expired</Badge>
                        ) : (
                          <Badge tone="warning">
                            Expires{" "}
                            {new Date(link.expires_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </Badge>
                        ))}
                      {link.utm_enabled && <Badge tone="info">UTM</Badge>}
                    </div>
                  </div>

                  {/* Clicks + actions (above the stretched title button). */}
                  <div className="relative z-20 flex shrink-0 items-start gap-1">
                    <div className="mr-1 text-right" title={clickCountTitle}>
                      {clickCounts ? (
                        <>
                          <p className="text-xl font-bold leading-none tabular-nums text-slate-900 sm:text-2xl">
                            <span className="sm:hidden">{formatCompact(count ?? 0)}</span>
                            <span className="hidden sm:inline">{formatNumber(count ?? 0)}</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {(count ?? 0) === 1 ? "click" : "clicks"}
                          </p>
                        </>
                      ) : (
                        <Skeleton className="h-7 w-12" />
                      )}
                    </div>
                    {!readOnly && onEditLink && (
                      <span className="hidden sm:block">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          label={`Edit ${link.link_title}`}
                          onClick={() => onEditLink(link)}
                        />
                      </span>
                    )}
                    {!readOnly && (
                      <DropdownMenu
                        label={`Actions for ${link.link_title}`}
                        items={[
                          ...(onEditLink
                            ? [{ label: "Edit link", icon: Pencil, onSelect: () => onEditLink(link) }]
                            : []),
                          {
                            label: "Open destination",
                            icon: ExternalLink,
                            onSelect: () => window.open(link.destination_url, "_blank", "noopener"),
                          },
                          {
                            label: "Delete link",
                            description: "Also deletes its click data",
                            icon: Trash2,
                            tone: "danger" as const,
                            onSelect: () => setPendingDelete(link),
                          },
                        ]}
                        trigger={(props) => (
                          <button
                            {...props}
                            type="button"
                            aria-label={`More actions for ${link.link_title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      />
                    )}
                  </div>
                </div>

                <div className="relative z-10 mt-3 space-y-1.5 sm:pl-[3.25rem]">
                  {trackingUrl && (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <code
                        className="min-w-0 flex-1 truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700"
                        title={trackingUrl}
                      >
                        {trackingUrl}
                      </code>
                      <CopyButton
                        text={trackingUrl}
                        iconOnly
                        variant="ghost"
                        label={`Copy tracking URL for ${link.link_title}`}
                        className="h-7 w-7"
                      />
                    </div>
                  )}
                  <a
                    href={link.destination_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.destination_url}
                    className="block w-fit max-w-full truncate text-sm text-primary-700 hover:underline"
                  >
                    {link.destination_url}
                  </a>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600 sm:pl-[3.25rem]">
                  <span>{edited ? `Edited ${edited}` : ""}</span>
                  {selectable && (
                    <span className="inline-flex items-center gap-0.5 font-medium text-primary-700">
                      View analytics
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await onDeleteLink(pendingDelete.id);
        }}
        title="Delete this link?"
        description={
          <>
            <strong>{pendingDelete?.link_title}</strong> and all of its click data
            will be permanently deleted. Tracking URLs already shared will stop
            working.
          </>
        }
        confirmLabel="Delete link"
      />
    </>
  );
}
