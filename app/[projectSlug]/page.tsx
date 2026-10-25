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
import { Link2, MousePointerClick, TrendingUp } from "lucide-react";

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Project Not Found
          </h1>
          <p className="text-gray-600 mb-4">
            {error || "The requested project could not be found."}
          </p>
          {/* <button
            onClick={() => router.push("/")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button> */}
        </div>
      </div>
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
        onBack={() => {
          setSelectedLinkId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("link_id");
          window.history.replaceState({}, "", url.toString());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
          {project.description && (
            <p className="text-slate-600 mt-2">{project.description}</p>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <StatCard
            label="Total Links"
            value={links.length}
            icon={Link2}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />

          <StatCard
            label={hideBots ? "Genuine Clicks" : "Total Clicks"}
            value={hideBots ? stats.humanClicks : stats.totalClicks}
            icon={MousePointerClick}
            iconBg="bg-green-50"
            iconColor="text-green-600"
          />

          <StatCard
            label="Platforms"
            value={platformCount}
            icon={TrendingUp}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
        </div>

        {links.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              No links yet
            </h3>
            <p className="text-slate-600">This project has no public links.</p>
          </div>
        ) : (
          <>
            <TitleSearchBar
              value={linkSearch}
              onChange={setLinkSearch}
              placeholder="Search links by title..."
              className="mb-6 max-w-md"
            />
            {filteredLinks.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
                <p className="text-slate-600">
                  No links match &quot;{linkSearch.trim()}&quot;.
                </p>
                <button
                  type="button"
                  onClick={() => setLinkSearch("")}
                  className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <LinkList
                links={filteredLinks}
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
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
