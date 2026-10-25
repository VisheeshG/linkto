"use client";

import { useState, useEffect } from "react";
import { Link } from "@/lib/supabase";
import { buildTrackingUrlTemplate } from "@/lib/tracking-url";
import {
  Link2,
  Copy,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { LastEditedLabel } from "./LastEditedLabel";

interface LinkListProps {
  links: Link[];
  onSelectLink: (link: Link) => void;
  onDeleteLink: (linkId: string) => void;
  onEditLink?: (link: Link) => void;
  projectSlug: string;
  brandSlug?: string | null;
  readOnly?: boolean;
  enableSelectInReadOnly?: boolean;
}

export function LinkList({
  links,
  onSelectLink,
  onDeleteLink,
  onEditLink,
  projectSlug,
  brandSlug = null,
  readOnly = false,
  enableSelectInReadOnly = false,
}: LinkListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    linkId: string | null;
    linkTitle: string | null;
  }>({ show: false, linkId: null, linkTitle: null });

  const isCardClickable = !readOnly || enableSelectInReadOnly;

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

  const handleCopy = (e: React.MouseEvent, link: Link) => {
    e.stopPropagation();
    navigator.clipboard.writeText(urlForLink(link));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (
    e: React.MouseEvent,
    linkId: string,
    linkTitle: string
  ) => {
    e.stopPropagation();
    setDeleteConfirm({ show: true, linkId, linkTitle });
  };

  const confirmDelete = () => {
    if (deleteConfirm.linkId) {
      onDeleteLink(deleteConfirm.linkId);
    }
    setDeleteConfirm({ show: false, linkId: null, linkTitle: null });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, linkId: null, linkTitle: null });
  };

  return (
    <>
      <div className="space-y-4">
        {links.map((link) => (
          <div
            key={link.id}
            className={`relative bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition group ${
              isCardClickable ? "clickable-card" : ""
            }`}
          >
            {isCardClickable && (
              <button
                type="button"
                onClick={() => onSelectLink(link)}
                className="absolute inset-0 z-0 w-full h-full rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label={`View analytics for ${link.link_title}`}
              />
            )}

            <div className="relative z-10 p-4 sm:p-6 pointer-events-none">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition flex-shrink-0">
                    <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition break-words text-left">
                      {link.link_title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>{link.platform}</span>
                      {link.expires_at &&
                        (new Date(link.expires_at) <= new Date() ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            Expired
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Expires{" "}
                            {new Date(link.expires_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ))}
                      {link.utm_enabled && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          UTM
                        </span>
                      )}
                    </p>
                    {baseUrl && (
                      <p className="text-xs text-slate-600 mt-2 font-mono break-all">
                        {urlForLink(link)}
                      </p>
                    )}
                    <a
                      href={link.destination_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:underline break-all block sm:inline sm:ml-2 mt-1 pointer-events-auto"
                    >
                      {link.destination_url}
                    </a>
                    <LastEditedLabel
                      updatedAt={link.updated_at}
                      createdAt={link.created_at}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 pointer-events-auto shrink-0">
                  {!readOnly && onEditLink && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditLink(link);
                      }}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition cursor-pointer"
                      title="Edit link"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, link)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    title="Copy tracking URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) =>
                        handleDelete(e, link.id, link.link_title)
                      }
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {isCardClickable && (
                <div className="mt-3 flex items-center space-x-2 text-blue-600 text-sm font-medium sm:opacity-0 sm:group-hover:opacity-100 transition pointer-events-none">
                  <span>View analytics</span>
                  <ExternalLink className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="clickable-backdrop absolute inset-0 bg-black/50"
            onClick={cancelDelete}
          />
          <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Link</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete &quot;{deleteConfirm.linkTitle}
              &quot;? This will also delete all associated click data.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition font-medium"
              >
                Delete
              </button>
              <button
                onClick={cancelDelete}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {copiedId && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          Tracking URL copied
        </div>
      )}
    </>
  );
}
