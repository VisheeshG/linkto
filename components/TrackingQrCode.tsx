"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import { buildTrackingUrlTemplate } from "@/lib/tracking-url";

type TrackingQrCodeProps = {
  baseUrl: string;
  brandSlug: string | null;
  projectSlug: string;
  shortCode: string;
  includeSubmissionInUrl: boolean;
  fileNamePrefix: string;
};

const CREATOR_PATTERN = /^[A-Za-z0-9._-]+$/;

/** QR code for a creator-specific tracking URL (print, posters, packaging). */
export function TrackingQrCode({
  baseUrl,
  brandSlug,
  projectSlug,
  shortCode,
  includeSubmissionInUrl,
  fileNamePrefix,
}: TrackingQrCodeProps) {
  const [creator, setCreator] = useState("");
  const [submission, setSubmission] = useState("sub1");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const trimmedCreator = creator.trim();
  const creatorValid = CREATOR_PATTERN.test(trimmedCreator);
  const submissionValid = !includeSubmissionInUrl || /^sub\d+$/.test(submission);

  const url =
    creatorValid && submissionValid
      ? buildTrackingUrlTemplate({
          baseUrl,
          brandSlug,
          projectSlug,
          shortCode,
          includeSubmissionInUrl,
          creatorPlaceholder: trimmedCreator,
          submissionPlaceholder: submission,
        })
      : null;

  useEffect(() => {
    if (!url) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-slate-900 rounded-lg">
          <QrCode className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
            QR code
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            Generate a scannable code for a creator&apos;s tracking link. Scans
            are tracked like any other click.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="flex-1 space-y-3">
          <div>
            <label
              htmlFor="qr-creator"
              className="block text-sm font-bold text-slate-700 mb-1.5"
            >
              Creator
            </label>
            <input
              id="qr-creator"
              type="text"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="e.g. johndoe"
              className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {trimmedCreator && !creatorValid && (
              <p className="text-xs text-amber-600 mt-1">
                Use letters, numbers, dots, dashes or underscores only.
              </p>
            )}
          </div>
          {includeSubmissionInUrl && (
            <div>
              <label
                htmlFor="qr-submission"
                className="block text-sm font-bold text-slate-700 mb-1.5"
              >
                Submission
              </label>
              <input
                id="qr-submission"
                type="text"
                value={submission}
                onChange={(e) => setSubmission(e.target.value.trim())}
                className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
              {!submissionValid && (
                <p className="text-xs text-amber-600 mt-1">
                  Must look like sub1, sub2, …
                </p>
              )}
            </div>
          )}
          {url && (
            <code className="block bg-slate-50 px-3 py-2 rounded-xl font-mono text-xs text-slate-700 break-all border border-slate-200">
              {url}
            </code>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <div
            className={`w-40 h-40 rounded-xl border-2 border-dashed border-slate-200 items-center justify-center overflow-hidden bg-white ${
              dataUrl ? "flex" : "hidden sm:flex"
            }`}
          >
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL, not optimizable
              <img src={dataUrl} alt={`QR code for ${url}`} className="w-full h-full" />
            ) : (
              <span className="text-xs text-slate-400 text-center px-3">
                Enter a creator to generate
              </span>
            )}
          </div>
          {dataUrl && (
            <a
              href={dataUrl}
              download={`${fileNamePrefix}_${trimmedCreator}_qr.png`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
