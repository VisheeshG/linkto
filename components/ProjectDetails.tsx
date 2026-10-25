"use client";

import { StatCard } from "@/components/StatCard";
import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Project, Link, supabase } from "@/lib/supabase";
import {
  Plus,
  Link2,
  TrendingUp,
  MousePointerClick,
  Shield,
  Pencil,
} from "lucide-react";
import { LinkList } from "./LinkList";
import { EditLinkModal, LinkEditPayload } from "./EditLinkModal";
import { LastEditedLabel } from "./LastEditedLabel";
import { TitleSearchBar } from "./TitleSearchBar";
import { matchesTitleQuery } from "@/lib/search";
import { Analytics } from "./Analytics";
import { SocialShare } from "./SocialShare";
import { ProjectPasswordManager } from "./ProjectPasswordManager";
import { generateUniqueShortCode } from "@/lib/generators";
import {
  countClicksPerLink,
  fetchAllLinksForProjectId,
} from "@/lib/supabase-pagination";
import { canOpenInNativeApp } from "@/lib/mobile-app-redirect";
import toast from "react-hot-toast";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";
import {
  LinkAdvancedOptions,
  LinkExtras,
  localInputToIso,
} from "./LinkAdvancedOptions";

interface ProjectDetailsProps {
  project: Project;
  onProjectUpdated?: (project: Project) => void;
}

function ProjectDetailsContent({
  project: initialProject,
  onProjectUpdated,
}: ProjectDetailsProps) {
  const [project, setProject] = useState(initialProject);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [showNewLink, setShowNewLink] = useState(false);
  const [showPasswordManager, setShowPasswordManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalClicks, setTotalClicks] = useState(0);
  const [platformCount, setPlatformCount] = useState(0);
  const [projectUrl, setProjectUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string>("");
  const [hideBots] = useHideBotClicks();
  const [linkClickCounts, setLinkClickCounts] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [formResetKey, setFormResetKey] = useState(0);
  const [linkSearch, setLinkSearch] = useState("");
  const [brandName, setBrandName] = useState<string | null>(null);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectName, setEditProjectName] = useState(initialProject.name);
  const [editProjectDescription, setEditProjectDescription] = useState(
    initialProject.description ?? ""
  );
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  useEffect(() => {
    setProject(initialProject);
    setEditProjectName(initialProject.name);
    setEditProjectDescription(initialProject.description ?? "");
  }, [initialProject]);

  useEffect(() => {
    if (!project.brand_id) {
      setBrandName(null);
      setBrandSlug(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("name, slug")
        .eq("id", project.brand_id)
        .single();
      if (!cancelled) {
        setBrandName(data?.name ?? null);
        setBrandSlug(data?.slug ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project.brand_id]);

  const filteredLinks = useMemo(
    () =>
      links.filter((l) => matchesTitleQuery(linkSearch, l.link_title)),
    [links, linkSearch]
  );
  const newLinkBackdropPointerDown = useRef(false);
  const passwordBackdropPointerDown = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const loadLinks = useCallback(async () => {
    try {
      const data = await fetchAllLinksForProjectId(supabase, project.id);
      setLinks(data);

      if (data.length > 0) {
        const linkIds = data.map((l) => l.id);
        const counts = await countClicksPerLink(supabase, linkIds, {
          humanOnly: hideBots,
        });
        setLinkClickCounts(counts);
        setTotalClicks(Object.values(counts).reduce((sum, n) => sum + n, 0));

        const uniquePlatforms = new Set(data.map((l) => l.platform));
        setPlatformCount(uniquePlatforms.size);
      } else {
        setLinkClickCounts({});
        setTotalClicks(0);
        setPlatformCount(0);
      }
    } catch (error) {
      console.error("Error loading links:", error);
    } finally {
      setLoading(false);
    }
  }, [project, hideBots]);

  useEffect(() => {
    loadLinks();
    // Set the project URL for sharing (public view by slug)
    setProjectUrl(`${window.location.origin}/${project.slug}`);

    // Get access token for API calls
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setAccessToken(session.access_token);
      }
    });
  }, [loadLinks, project.id, project.slug]);

  useEffect(() => {
    if (!links.length) return;
    // Support two formats:
    // 1) ?link_id=<uuid>
    // 2) ?<uuid> (id-only query key with empty value)
    const linkIdFromQuery = searchParams.get("link_id");
    let resolvedId: string | null = linkIdFromQuery;

    if (!resolvedId) {
      const entries = Array.from(searchParams.entries());
      if (entries.length === 1) {
        const [firstKey, value] = entries[0];
        if (value === "") {
          resolvedId = firstKey;
        }
      }
    }

    if (!resolvedId) return;
    const match = links.find((l) => l.id === resolvedId);
    if (match) {
      setSelectedLink(match);
    }
  }, [links, searchParams]);

  // Close modals on Escape key and prevent body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNewLink) setShowNewLink(false);
        if (showPasswordManager) setShowPasswordManager(false);
      }
    };

    // Prevent body scroll when modal is open
    if (showNewLink || showPasswordManager) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "unset";
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showNewLink, showPasswordManager]);

  const handleSaveProject = async () => {
    const trimmedName = editProjectName.trim();
    const trimmedDescription = editProjectDescription.trim();

    if (!trimmedName) {
      toast.error("Project name is required");
      return;
    }

    setIsSavingProject(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          name: trimmedName,
          description: trimmedDescription || null,
        })
        .eq("id", project.id)
        .select()
        .single();

      if (error) throw error;

      setProject(data);
      onProjectUpdated?.(data);
      setIsEditingProject(false);
      toast.success("Project updated");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error updating project"
      );
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleUpdateLink = async (
    linkId: string,
    payload: LinkEditPayload
  ): Promise<boolean> => {
    try {
      const { data: existingUrl, error: urlCheckError } = await supabase
        .from("links")
        .select("id, link_title")
        .eq("project_id", project.id)
        .eq("destination_url", payload.destination_url)
        .neq("id", linkId)
        .maybeSingle();

      if (urlCheckError && urlCheckError.code !== "PGRST116") {
        throw urlCheckError;
      }

      if (existingUrl) {
        toast.error(
          `This destination URL already exists as "${existingUrl.link_title}".`
        );
        return false;
      }

      const { data, error } = await supabase
        .from("links")
        .update(payload)
        .eq("id", linkId)
        .select()
        .single();

      if (error) throw error;

      setLinks(links.map((l) => (l.id === linkId ? data : l)));
      if (selectedLink?.id === linkId) {
        setSelectedLink(data);
      }
      toast.success("Link updated");
      return true;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error updating link"
      );
      return false;
    }
  };

  const handleCreateLink = async (
    linkTitle: string,
    platform: string,
    destinationUrl: string,
    shortCode: string,
    openAppOnMobile: boolean,
    includeSubmissionInUrl: boolean,
    extras: LinkExtras
  ) => {
    try {
      // Check if destination URL already exists in this project
      const { data: existingUrl, error: urlCheckError } = await supabase
        .from("links")
        .select("id, destination_url, link_title")
        .eq("project_id", project.id)
        .eq("destination_url", destinationUrl)
        .single();

      if (urlCheckError && urlCheckError.code !== "PGRST116") {
        throw urlCheckError;
      }

      if (existingUrl) {
        toast.error(
          `This destination URL already exists in this project as "${existingUrl.link_title}". Please use a different URL.`
        );
        return false;
      }

      // Verify short code is truly unique before inserting (safety check)
      const { data: existingShortCode } = await supabase
        .from("links")
        .select("id")
        .eq("short_code", shortCode)
        .single();

      // If short code already exists, generate a new unique one
      let finalShortCode = shortCode;
      if (existingShortCode) {
        console.log(
          `Short code ${shortCode} already exists, generating new one...`
        );
        finalShortCode = await generateUniqueShortCode(supabase);
        console.log(`Generated new short code: ${finalShortCode}`);
      }

      // All links use "sub1" as the submission number
      const submissionNumber = "sub1";

      const { data, error } = await supabase
        .from("links")
        .insert({
          project_id: project.id,
          link_title: linkTitle,
          platform,
          destination_url: destinationUrl,
          short_code: finalShortCode,
          submission_number: submissionNumber,
          open_app_on_mobile: openAppOnMobile,
          include_submission_in_url: includeSubmissionInUrl,
          utm_enabled: extras.utm_enabled,
          expires_at: extras.expires_at,
        })
        .select()
        .single();

      if (error) throw error;

      setLinks([data, ...links]);
      setShowNewLink(false);
      setFormResetKey((prev) => prev + 1); // Reset form for next link
      return true;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error creating link"
      );
      return false;
    }
  };

  const handleSelectLink = (link: Link) => {
    setSelectedLink(link);
    // Write the URL as ?<id> (id-only, no key)
    router.push(`?${link.id}`);
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      // Click data is removed by ON DELETE CASCADE on link_clicks.link_id.
      const { error } = await supabase.from("links").delete().eq("id", linkId);
      if (error) throw error;

      setLinks(links.filter((l) => l.id !== linkId));
      if (selectedLink?.id === linkId) {
        setSelectedLink(null);
      }
      toast.success("Link and all click data deleted successfully");
    } catch (error: unknown) {
      console.error("Error deleting link:", error);
      toast.error(
        error instanceof Error ? error.message : "Error deleting link"
      );
    }
  };

  if (selectedLink) {
    return (
      <Analytics
        link={selectedLink}
        onBack={() => {
          setSelectedLink(null);
          // Remove either ?link_id=<id> or ?<id> from the URL
          const params = new URLSearchParams(
            Array.from(searchParams.entries())
          );
          params.delete("link_id");
          // Also delete the id-only key if present
          if (selectedLink?.id) {
            params.delete(selectedLink.id);
          }
          const qs = params.toString();
          router.replace(qs ? `?${qs}` : `/dashboard/${project.id}`);
        }}
        projectSlug={project.slug}
        brandSlug={brandSlug}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-600 mb-3 sm:mb-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="hover:text-blue-600 font-medium"
            >
              Dashboard
            </button>
            {project.brand_id && brandName && (
              <>
                <span className="text-slate-400">/</span>
                <button
                  onClick={() =>
                    router.push(`/dashboard/brands/${project.brand_id}`)
                  }
                  className="hover:text-violet-600 font-medium"
                >
                  {brandName}
                </button>
              </>
            )}
            <span className="text-slate-400">/</span>
            <span className="text-slate-900 font-medium truncate max-w-[200px] sm:max-w-none">
              {project.name}
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
            <div className="flex-1 min-w-0">
              {isEditingProject ? (
                <div className="space-y-3 max-w-xl mb-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Project title
                    </label>
                    <input
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      className="w-full text-lg font-bold border-2 border-blue-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Description{" "}
                      <span className="font-normal text-slate-400">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      value={editProjectDescription}
                      onChange={(e) =>
                        setEditProjectDescription(e.target.value)
                      }
                      rows={2}
                      className="w-full border-2 border-blue-300 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveProject}
                      disabled={isSavingProject}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-semibold disabled:opacity-50"
                    >
                      {isSavingProject ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProject(false);
                        setEditProjectName(project.name);
                        setEditProjectDescription(project.description ?? "");
                      }}
                      disabled={isSavingProject}
                      className="px-4 py-2 bg-slate-100 text-sm rounded-lg font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">
                      {project.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setEditProjectName(project.name);
                        setEditProjectDescription(project.description ?? "");
                        setIsEditingProject(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg shrink-0 cursor-pointer"
                      aria-label="Edit project"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  {project.description && (
                    <p className="text-sm sm:text-base text-slate-600 font-medium">
                      {project.description}
                    </p>
                  )}
                  <LastEditedLabel
                    updatedAt={project.updated_at}
                    createdAt={project.created_at}
                    className="mt-2"
                  />
                </>
              )}
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setShowPasswordManager(true)}
                className="group flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-3 sm:px-4 py-2 rounded-xl transition-all duration-200 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg hover:scale-105"
                title="Manage Access Passwords"
              >
                <Shield className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                <span>Passwords</span>
              </button>
              <SocialShare
                projectName={project.name}
                projectDescription={project.description || undefined}
                projectUrl={projectUrl}
                className="mt-0 sm:mt-2"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
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
            value={totalClicks}
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

        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Links
            </h2>
            <button
              onClick={() => setShowNewLink(!showNewLink)}
              className="group flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 sm:px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl w-full sm:w-auto hover:scale-105"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
              <span>New Link</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 animate-pulse shadow-lg">
              <Link2 className="w-8 h-8 text-white" />
            </div>
            <p className="text-slate-700 font-semibold text-lg">
              Loading links...
            </p>
            <p className="text-slate-500 text-sm mt-1">Please wait</p>
          </div>
        ) : links.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 sm:p-12 lg:p-16 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl mb-6">
              <Link2 className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
              No links yet
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mb-6 sm:mb-8 max-w-md mx-auto">
              Create your first trackable link for this project and start
              monitoring clicks
            </p>
            <button
              onClick={() => setShowNewLink(true)}
              className="group inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
              <span>Create Link</span>
            </button>
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
                onSelectLink={handleSelectLink}
                onDeleteLink={handleDeleteLink}
                onEditLink={setEditingLink}
                projectSlug={project.slug}
                brandSlug={brandSlug}
                clickCounts={linkClickCounts}
                clickCountTitle={
                  hideBots ? "Genuine clicks (bots hidden)" : "All clicks"
                }
              />
            )}
          </>
        )}
      </div>

      {/* New Link Modal */}
      {showNewLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div
            className="clickable-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              newLinkBackdropPointerDown.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
              if (
                e.target === e.currentTarget &&
                newLinkBackdropPointerDown.current
              ) {
                setShowNewLink(false);
              }
              newLinkBackdropPointerDown.current = false;
            }}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[95vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
            <NewLinkForm
              key={formResetKey}
              onSubmit={handleCreateLink}
              onCancel={() => setShowNewLink(false)}
            />
          </div>
        </div>
      )}

      {editingLink && (
        <EditLinkModal
          link={editingLink}
          onSave={handleUpdateLink}
          onClose={() => setEditingLink(null)}
        />
      )}

      {/* Password Management Modal */}
      {showPasswordManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div
            className="clickable-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              passwordBackdropPointerDown.current =
                e.target === e.currentTarget;
            }}
            onClick={(e) => {
              if (
                e.target === e.currentTarget &&
                passwordBackdropPointerDown.current
              ) {
                setShowPasswordManager(false);
              }
              passwordBackdropPointerDown.current = false;
            }}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white rounded-2xl shadow-2xl">
              <ProjectPasswordManager
                projectId={project.id}
                accessToken={accessToken}
                projectSlug={project.slug}
                onClose={() => setShowPasswordManager(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectDetails({
  project,
  onProjectUpdated,
}: ProjectDetailsProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Loading...</div>
        </div>
      }
    >
      <ProjectDetailsContent
        project={project}
        onProjectUpdated={onProjectUpdated}
      />
    </Suspense>
  );
}

function NewLinkForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (
    linkTitle: string,
    platform: string,
    destinationUrl: string,
    shortCode: string,
    openAppOnMobile: boolean,
    includeSubmissionInUrl: boolean,
    extras: LinkExtras
  ) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [linkTitle, setLinkTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [openAppOnMobile, setOpenAppOnMobile] = useState(false);
  const [includeSubmissionInUrl, setIncludeSubmissionInUrl] = useState(false);
  const [utmEnabled, setUtmEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLinkTitleChange = (value: string) => {
    setLinkTitle(value);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Auto-generate unique short code when link title changes (with debounce)
    if (value.trim()) {
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const uniqueCode = await generateUniqueShortCode(supabase);
          console.log(`Generated short code for "${value}":`, uniqueCode);
          setShortCode(uniqueCode);
        } catch (error) {
          console.error("Error auto-generating short code:", error);
        }
      }, 500); // 500ms debounce
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submissions

    // Validate that shortCode is not empty
    if (!shortCode.trim()) {
      toast.error(
        "Please wait for the short code to be generated before submitting."
      );
      return;
    }

    if (openAppOnMobile && !canOpenInNativeApp(destinationUrl)) {
      toast.error(
        "This URL is not from a supported app platform. Use YouTube, Instagram, TikTok, X/Twitter, Facebook, or Spotify links."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(
        linkTitle,
        platform,
        destinationUrl,
        shortCode,
        openAppOnMobile,
        includeSubmissionInUrl,
        { utm_enabled: utmEnabled, expires_at: localInputToIso(expiresAt) }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-4 sm:p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Link2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            Create New Link
          </h3>
          <p className="text-xs text-slate-600">Set up a trackable link</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="linkTitle"
            className="block text-sm font-bold text-slate-700 mb-1.5"
          >
            Link Title
          </label>
          <input
            id="linkTitle"
            type="text"
            value={linkTitle}
            onChange={(e) => handleLinkTitleChange(e.target.value)}
            className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="title"
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            A descriptive title for this link
          </p>
        </div>

        <div>
          <label
            htmlFor="platform"
            className="block text-sm font-bold text-slate-700 mb-1.5"
          >
            Platform Name
          </label>
          <input
            id="platform"
            type="text"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="e.g., Instagram, YouTube, TikTok, Twitter"
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            The platform name that will be tracked in analytics
          </p>
        </div>

        <div>
          <label
            htmlFor="destinationUrl"
            className="block text-sm font-bold text-slate-700 mb-1.5"
          >
            Destination URL
          </label>
          <input
            id="destinationUrl"
            type="url"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="https://www.youtube.com/watch?v=..."
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
            <span>
              <span className="block text-sm font-bold text-slate-700">
                Include submission in tracking URL
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                When enabled, links end with{" "}
                <span className="font-mono">/sub1</span> (e.g. for multiple
                posts). When off, URLs end with the creator name only — cleaner
                for bios.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={openAppOnMobile}
              onChange={(e) => setOpenAppOnMobile(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-bold text-slate-700">
                Open in native app on mobile
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                On phones, opens the matching app (e.g. YouTube podcast in the
                YouTube app, Instagram posts in Instagram) instead of the
                in-app browser. Works with YouTube, Instagram, TikTok, X,
                Facebook, and Spotify URLs.
              </span>
              {destinationUrl.trim() &&
                openAppOnMobile &&
                !canOpenInNativeApp(destinationUrl) && (
                  <span className="block text-xs text-amber-600 mt-1 font-medium">
                    This destination URL is not from a supported platform.
                  </span>
                )}
            </span>
          </label>
        </div>

        <LinkAdvancedOptions
          idPrefix="new-link"
          utmEnabled={utmEnabled}
          onUtmEnabledChange={setUtmEnabled}
          expiresAt={expiresAt}
          onExpiresAtChange={setExpiresAt}
        />

        <div>
          <label
            htmlFor="shortCode"
            className="block text-sm font-bold text-slate-700 mb-1.5"
          >
            Short Code
          </label>
          <input
            id="shortCode"
            type="text"
            value={shortCode}
            readOnly
            className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-xl bg-slate-50 text-slate-600 cursor-not-allowed font-mono"
            placeholder="Auto-generated code"
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Auto-generated when you type a link title. Each link gets a unique
            short code (format: 2 letters + 3 numbers, e.g., ab123). This field
            cannot be edited.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 text-sm rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
        >
          {isSubmitting ? "Creating..." : "Create Link"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 text-sm rounded-xl transition-all font-semibold disabled:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 shadow-sm hover:shadow-md"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
