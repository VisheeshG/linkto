"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/supabase";
import { canOpenInNativeApp } from "@/lib/mobile-app-redirect";
import { Link2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  LinkAdvancedOptions,
  LinkExtras,
  isoToLocalInput,
  localInputToIso,
} from "./LinkAdvancedOptions";

export interface LinkEditPayload extends LinkExtras {
  link_title: string;
  platform: string;
  destination_url: string;
  open_app_on_mobile: boolean;
  include_submission_in_url: boolean;
}

interface EditLinkModalProps {
  link: Link;
  onSave: (linkId: string, payload: LinkEditPayload) => Promise<boolean>;
  onClose: () => void;
}

export function EditLinkModal({ link, onSave, onClose }: EditLinkModalProps) {
  const [linkTitle, setLinkTitle] = useState(link.link_title);
  const [platform, setPlatform] = useState(link.platform);
  const [destinationUrl, setDestinationUrl] = useState(link.destination_url);
  const [openAppOnMobile, setOpenAppOnMobile] = useState(
    link.open_app_on_mobile ?? false
  );
  const [includeSubmissionInUrl, setIncludeSubmissionInUrl] = useState(
    link.include_submission_in_url ?? false
  );
  const [utmEnabled, setUtmEnabled] = useState(link.utm_enabled ?? false);
  const [expiresAt, setExpiresAt] = useState(isoToLocalInput(link.expires_at));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLinkTitle(link.link_title);
    setPlatform(link.platform);
    setDestinationUrl(link.destination_url);
    setOpenAppOnMobile(link.open_app_on_mobile ?? false);
    setIncludeSubmissionInUrl(link.include_submission_in_url ?? false);
    setUtmEnabled(link.utm_enabled ?? false);
    setExpiresAt(isoToLocalInput(link.expires_at));
  }, [link]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = linkTitle.trim();
    const trimmedPlatform = platform.trim();
    const trimmedUrl = destinationUrl.trim();

    if (!trimmedTitle || !trimmedPlatform || !trimmedUrl) {
      toast.error("Title, platform, and destination URL are required");
      return;
    }

    if (openAppOnMobile && !canOpenInNativeApp(trimmedUrl)) {
      toast.error(
        "This URL is not from a supported app platform for mobile app open."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSave(link.id, {
        link_title: trimmedTitle,
        platform: trimmedPlatform,
        destination_url: trimmedUrl,
        open_app_on_mobile: openAppOnMobile,
        include_submission_in_url: includeSubmissionInUrl,
        utm_enabled: utmEnabled,
        expires_at: localInputToIso(expiresAt),
      });
      if (ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="clickable-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg max-h-[95vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit link</h3>
            <p className="text-xs text-slate-600">
              Short code{" "}
              <span className="font-mono font-semibold">{link.short_code}</span>{" "}
              stays the same — tracking URLs you already shared keep working.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="edit-link-title"
              className="block text-sm font-bold text-slate-700 mb-1.5"
            >
              Link title
            </label>
            <input
              id="edit-link-title"
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="edit-link-platform"
              className="block text-sm font-bold text-slate-700 mb-1.5"
            >
              Platform
            </label>
            <input
              id="edit-link-platform"
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="edit-link-destination"
              className="block text-sm font-bold text-slate-700 mb-1.5"
            >
              Destination URL
            </label>
            <input
              id="edit-link-destination"
              type="url"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div className="rounded-xl border-2 border-slate-200 p-3 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSubmissionInUrl}
                onChange={(e) => setIncludeSubmissionInUrl(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">
                Include submission in tracking URL (
                <span className="font-mono">/sub1</span>)
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={openAppOnMobile}
                onChange={(e) => setOpenAppOnMobile(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">
                Open in native app on mobile
              </span>
            </label>
          </div>

          <LinkAdvancedOptions
            idPrefix="edit-link"
            utmEnabled={utmEnabled}
            onUtmEnabledChange={setUtmEnabled}
            expiresAt={expiresAt}
            onExpiresAtChange={setExpiresAt}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
