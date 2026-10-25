"use client";

import { StatCard } from "@/components/StatCard";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import type { Project, Link } from "@/lib/supabase";
import { LinkList } from "@/components/LinkList";
import { TitleSearchBar } from "@/components/TitleSearchBar";
import { matchesTitleQuery } from "@/lib/search";
import { Analytics } from "@/components/Analytics";
import { PasswordVerificationModal } from "@/components/PasswordVerificationModal";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";
import type { ClickSource } from "@/lib/click-source";
import { Link2, MousePointerClick, SearchX, Trophy } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { Button, EmptyState, LoadingBlock, PageHeader, Skeleton } from "@/components/ui";
import { formatNumber } from "@/lib/format";

type PublicProject = Pick<Project, "id" | "name" | "description" | "slug">;

type StoredAuth = { accessToken: string; expiresAt: string };

function storageKey(projectSlug: string) {
  return `project_auth_${projectSlug}`;
}

function readStoredToken(projectSlug: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(projectSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      !parsed.accessToken ||
      !parsed.expiresAt ||
      new Date(parsed.expiresAt) <= new Date()
    ) {
      localStorage.removeItem(storageKey(projectSlug));
      return null;
    }
    return parsed.accessToken;
  } catch {
    return null;
  }
}

function clearStoredToken(projectSlug: string) {
  try {
    localStorage.removeItem(storageKey(projectSlug));
  } catch {
    // ignore
  }
}

export default function PublicProjectPage() {
  const params = useParams();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [lockedProjectName, setLockedProjectName] = useState<string | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalClicks: 0, humanClicks: 0 });
  const [linkClicks, setLinkClicks] = useState<{
    total: Record<string, number>;
    human: Record<string, number>;
  } | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [hideBots] = useHideBotClicks();

  const projectSlug = params.projectSlug as string;

  const filteredLinks = useMemo(
    () => links.filter((l) => matchesTitleQuery(linkSearch, l.link_title)),
    [links, linkSearch]
  );

  const platformCount = useMemo(
    () => new Set(links.map((l) => l.platform)).size,
    [links]
  );

  const clickSource: ClickSource = useMemo(
    () => ({ kind: "public", projectSlug, accessToken }),
    [projectSlug, accessToken]
  );

  /** Loads the project; returns false when a password is required. */
  const loadProject = useCallback(
    async (token: string | null): Promise<boolean> => {
      const response = await fetch(
        `/api/public/projects/${encodeURIComponent(projectSlug)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        const data = await response.json().catch(() => ({}));
        if (token) clearStoredToken(projectSlug);
        setAccessToken(null);
        setProject(null);
        setLockedProjectName(data?.project?.name ?? "This project");
        return false;
      }

      if (!response.ok) {
        setError("The requested project could not be found.");
        return true;
      }

      const data = await response.json();
      setAccessToken(token);
      setLockedProjectName(null);
      setProject(data.project);
      setBrandSlug(data.brandSlug ?? null);
      setLinks(data.links ?? []);
      setStats(data.stats ?? { totalClicks: 0, humanClicks: 0 });
      setLinkClicks(data.linkClicks ?? null);

      // If URL has ?link_id=uuid, preselect that link
      const qId = new URLSearchParams(window.location.search).get("link_id");
      if (qId && (data.links as Link[]).some((l) => l.id === qId)) {
        setSelectedLinkId(qId);
      }
      return true;
    },
    [projectSlug]
  );

  useEffect(() => {
    if (!projectSlug) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadProject(readStoredToken(projectSlug));
      } catch (err) {
        console.error("Error loading project:", err);
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectSlug, loadProject]);

  const handlePasswordVerify = async (password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/verify-project-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_slug: projectSlug,
          password,
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        throw new Error(data.error || "Too many attempts");
      }

      if (!data.valid) return false;

      const token: string | null = data.accessToken ?? null;
      if (token) {
        try {
          localStorage.setItem(
            storageKey(projectSlug),
            JSON.stringify({ accessToken: token, expiresAt: data.expiresAt })
          );
        } catch {
          // ignore storage failures; the token still works for this visit
        }
      }

      setLoading(true);
      try {
        return await loadProject(token);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      console.error("Password verification error:", err);
      throw err;
    }
  };

  // Show password modal if required and not authenticated
  if (lockedProjectName && !project) {
    return (
      <PasswordVerificationModal
        projectName={lockedProjectName}
        projectSlug={projectSlug}
        onVerify={handlePasswordVerify}
      />
    );
  }

  if (loading) {
    return (
      <PublicShell>
        <LoadingBlock label="Loading report">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="mb-6 h-4 w-80 max-w-full" />
          <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="mb-3 h-28" />
          <Skeleton className="h-28" />
        </LoadingBlock>
      </PublicShell>
    );
  }

  if (error || !project) {
    return (
      <PublicShell>
        <EmptyState
          icon={SearchX}
          title="Report not found"
          description={
            error && error !== "The requested project could not be found."
              ? error
              : "This link may be mistyped, or the report is no longer shared. Ask the person who sent it for a new link."
          }
          className="mt-8"
        />
      </PublicShell>
    );
  }

  const selectedLink = selectedLinkId
    ? links.find((l) => l.id === selectedLinkId) || null
    : null;

  if (selectedLink) {
    return (
      <Analytics
        link={selectedLink}
        projectSlug={project.slug}
        brandSlug={brandSlug}
        clickSource={clickSource}
        projectName={project.name}
        onBack={() => {
          setSelectedLinkId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("link_id");
          window.history.replaceState({}, "", url.toString());
        }}
      />
    );
  }

  const counts = linkClicks ? (hideBots ? linkClicks.human : linkClicks.total) : undefined;
  const topLink = counts
    ? links.reduce<Link | null>(
        (best, l) => ((counts[l.id] ?? 0) > (best ? counts[best.id] ?? 0 : 0) ? l : best),
        null
      )
    : null;

  return (
    <PublicShell printable>
      <PageHeader
        title={project.name}
        description={project.description || undefined}
        meta={
          <span className="text-xs text-slate-600">
            Report as of{" "}
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 sm:mb-8">
        <StatCard
          label={hideBots ? "Genuine clicks" : "Total clicks"}
          value={hideBots ? stats.humanClicks : stats.totalClicks}
          icon={MousePointerClick}
          iconBg="bg-primary-50"
          iconColor="text-primary-600"
          sublabel={hideBots && stats.totalClicks !== stats.humanClicks ? "Bots excluded" : undefined}
        />
        <StatCard
          label="Links"
          value={links.length}
          icon={Link2}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          sublabel={`${platformCount} ${platformCount === 1 ? "platform" : "platforms"}`}
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            label="Top link"
            value={topLink && counts?.[topLink.id] ? topLink.link_title : "—"}
            icon={Trophy}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            sublabel={topLink && counts?.[topLink.id] ? `${formatNumber(counts[topLink.id])} clicks` : undefined}
            title={topLink?.link_title}
          />
        </div>
      </div>

      <section aria-labelledby="links-heading">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="links-heading" className="text-lg font-semibold text-slate-900">
              Links <span className="text-sm font-normal text-slate-600">{links.length}</span>
            </h2>
            <p className="text-sm text-slate-600 print-hidden">Open a link to see who clicked, where and when.</p>
          </div>
          {links.length > 3 && (
            <TitleSearchBar
              value={linkSearch}
              onChange={setLinkSearch}
              placeholder="Search links…"
              className="w-full sm:max-w-xs print-hidden"
            />
          )}
        </div>

        {links.length === 0 ? (
          <EmptyState icon={Link2} title="No links yet" description="Links will appear here once they're added." />
        ) : filteredLinks.length === 0 ? (
          <EmptyState
            title={`No links match “${linkSearch.trim()}”`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setLinkSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <LinkList
            links={
              counts
                ? [...filteredLinks].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
                : filteredLinks
            }
            onSelectLink={(link) => {
              setSelectedLinkId(link.id);
              const url = new URL(window.location.href);
              url.searchParams.set("link_id", link.id);
              window.history.replaceState({}, "", url.toString());
            }}
            onDeleteLink={() => {}}
            projectSlug={project.slug}
            brandSlug={brandSlug}
            readOnly
            enableSelectInReadOnly
            clickCounts={counts}
            clickCountTitle={hideBots ? "Genuine clicks (bots hidden)" : "All clicks"}
          />
        )}
      </section>
    </PublicShell>
  );
}
