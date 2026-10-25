"use client";

import { useEffect, useState } from "react";
import { KeyRound, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { Button, CopyButton, Dialog, TabPanel, Tabs } from "@/components/ui";
import { ProjectPasswordManager } from "@/components/ProjectPasswordManager";

type Tab = "share" | "passwords";

/**
 * "Who can see this project": the client link (copy / share) and the
 * access passwords that protect it.
 */
export function ShareAccessDialog({
  open,
  onClose,
  initialTab = "share",
  projectId,
  projectName,
  projectDescription,
  projectSlug,
  projectUrl,
  accessToken,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
  projectId: string;
  projectName: string;
  projectDescription?: string | null;
  projectSlug: string;
  projectUrl: string;
  accessToken: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const text = `${projectName}${projectDescription ? ` — ${projectDescription}` : ""}`;
  const enc = encodeURIComponent;
  const targets = [
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${enc(`${text}\n${projectUrl}`)}` },
    { label: "Email", icon: Mail, href: `mailto:?subject=${enc(`Campaign report: ${projectName}`)}&body=${enc(`${text}\n\n${projectUrl}`)}` },
    { label: "LinkedIn", icon: Share2, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(projectUrl)}` },
    { label: "X", icon: Share2, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(projectUrl)}` },
    { label: "Telegram", icon: Send, href: `https://t.me/share/url?url=${enc(projectUrl)}&text=${enc(text)}` },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share & access"
      description="Send clients a live, read-only report of this project."
      size="lg"
    >
      <Tabs<Tab>
        tabs={[
          { id: "share", label: "Share", icon: Share2 },
          { id: "passwords", label: "Passwords", icon: KeyRound },
        ]}
        value={tab}
        onChange={setTab}
        idPrefix="share-access"
        label="Share and access"
        className="mb-4"
      />

      <TabPanel id="share" active={tab} idPrefix="share-access" className="space-y-5">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-800">Client report link</p>
          <div className="flex items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800"
              title={projectUrl}
            >
              {projectUrl}
            </code>
            <CopyButton text={projectUrl} label="Copy" size="md" variant="primary" />
          </div>
          <p className="mt-1.5 text-xs text-slate-600">
            Anyone with this link can view the report. Add a password to restrict it.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">Send via</p>
          <div className="flex flex-wrap gap-2">
            {canNativeShare && (
              <Button
                variant="secondary"
                size="sm"
                icon={Share2}
                onClick={() =>
                  navigator
                    .share({ title: projectName, text, url: projectUrl })
                    .catch(() => undefined)
                }
              >
                Share…
              </Button>
            )}
            {targets.map(({ label, icon: Icon, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </a>
            ))}
          </div>
        </div>
      </TabPanel>

      <TabPanel id="passwords" active={tab} idPrefix="share-access">
        <ProjectPasswordManager
          projectId={projectId}
          accessToken={accessToken}
          projectSlug={projectSlug}
          embedded
        />
      </TabPanel>
    </Dialog>
  );
}
