"use client";

import { StatCard } from "@/components/StatCard";
import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Project, Link, supabase } from "@/lib/supabase";
import { Link2, MousePointerClick, Pencil, Plus, Share2, Trophy } from "lucide-react";
import { LinkList } from "./LinkList";
import { TitleSearchBar } from "./TitleSearchBar";
import { matchesTitleQuery } from "@/lib/search";
import { Analytics } from "./Analytics";
import { generateUniqueShortCode } from "@/lib/generators";
import {
  countClicksPerLink,
  fetchAllLinksForProjectId,
} from "@/lib/supabase-pagination";
import toast from "react-hot-toast";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";
import { AppPage, PageSkeleton } from "./app/AppPage";
import {
  Button,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Select,
  Skeleton,
} from "./ui";
import { LinkFormDialog, type LinkFormValues } from "./project/LinkFormDialog";
import { EditDetailsDialog } from "./project/EditDetailsDialog";
import { ShareAccessDialog } from "./project/ShareAccessDialog";
import { formatNumber, formatRelative } from "@/lib/format";

type LinkSort = "clicks" | "newest" | "edited" | "name";

type LinkExtras = Pick<LinkFormValues, "utm_enabled" | "expires_at">;

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
  const [shareDialog, setShareDialog] = useState<{ open: boolean; tab: "share" | "passwords" }>({
    open: false,
    tab: "share",
  });
  const [newShortCode, setNewShortCode] = useState("");
  const [linkSort, setLinkSort] = useState<LinkSort>("clicks");
  const [loading, setLoading] = useState(true);
  const [totalClicks, setTotalClicks] = useState(0);
  const [platformCount, setPlatformCount] = useState(0);
  const [projectUrl, setProjectUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string>("");
  const [hideBots] = useHideBotClicks();
  const [linkClickCounts, setLinkClickCounts] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [linkSearch, setLinkSearch] = useState("");
  const [brandName, setBrandName] = useState<string | null>(null);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  useEffect(() => {
    setProject(initialProject);
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

  const filteredLinks = useMemo(() => {
    const matching = links.filter((l) => matchesTitleQuery(linkSearch, l.link_title));
    const byDate = (a?: string | null, b?: string | null) => (b ?? "").localeCompare(a ?? "");
    return [...matching].sort((a, b) => {
      switch (linkSort) {
        case "clicks":
          return (
            (linkClickCounts?.[b.id] ?? 0) - (linkClickCounts?.[a.id] ?? 0) ||
            byDate(a.created_at, b.created_at)
          );
        case "edited":
          return byDate(a.updated_at || a.created_at, b.updated_at || b.created_at);
        case "name":
          return a.link_title.localeCompare(b.link_title, undefined, { numeric: true });
        default:
          return byDate(a.created_at, b.created_at);
      }
    });
  }, [links, linkSearch, linkSort, linkClickCounts]);

  const topLink = useMemo(() => {
    if (!linkClickCounts || links.length === 0) return null;
    const best = links.reduce((top, l) =>
      (linkClickCounts[l.id] ?? 0) > (linkClickCounts[top.id] ?? 0) ? l : top
    );
    return (linkClickCounts[best.id] ?? 0) > 0 ? best : null;
  }, [links, linkClickCounts]);
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

  // Short code for the "New link" dialog, generated once per opening.
  useEffect(() => {
    if (!showNewLink) return;
    let cancelled = false;
    setNewShortCode("");
    generateUniqueShortCode(supabase)
      .then((code) => {
        if (!cancelled) setNewShortCode(code);
      })
      .catch((error) => {
        console.error("Error generating short code:", error);
        toast.error("Couldn't generate a short code. Close and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [showNewLink]);

  const handleSaveProject = async (values: {
    name: string;
    description: string;
  }): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          name: values.name,
          description: values.description || null,
        })
        .eq("id", project.id)
        .select()
        .single();

      if (error) throw error;

      setProject(data);
      onProjectUpdated?.(data);
      toast.success("Project updated");
      return true;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error updating project"
      );
      return false;
    }
  };

  const handleUpdateLink = async (
    linkId: string,
    payload: LinkFormValues
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
      setLinkClickCounts((prev) => (prev ? { ...prev, [data.id]: 0 } : prev));
      toast.success("Link created");
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
    const backToProject = () => {
      setSelectedLink(null);
      // Remove either ?link_id=<id> or ?<id> from the URL
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.delete("link_id");
      // Also delete the id-only key if present
      if (selectedLink?.id) {
        params.delete(selectedLink.id);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : `/dashboard/${project.id}`);
    };
    return (
      <Analytics
        link={selectedLink}
        onBack={backToProject}
        projectSlug={project.slug}
        brandSlug={brandSlug}
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          ...(project.brand_id && brandName
            ? [{ label: brandName, href: `/dashboard/brands/${project.brand_id}` }]
            : []),
          { label: project.name, onClick: backToProject },
          { label: selectedLink.link_title },
        ]}
      />
    );
  }

  const crumbs = [
    { label: "Dashboard", href: "/dashboard" },
    ...(project.brand_id && brandName
      ? [{ label: brandName, href: `/dashboard/brands/${project.brand_id}` }]
      : []),
    { label: project.name },
  ];
  const edited = formatRelative(project.updated_at || project.created_at);

  return (
    <AppPage crumbs={crumbs}>
      <PageHeader
        title={project.name}
        description={
          <>
            {project.description && <p>{project.description}</p>}
            <p className="mt-1 text-xs text-slate-600">
              {brandName ? `${brandName} · ` : ""}
              {edited ? `Edited ${edited}` : ""}
            </p>
          </>
        }
        meta={
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            label="Edit project details"
            onClick={() => setShowEditProject(true)}
          />
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={Share2}
              onClick={() => setShareDialog({ open: true, tab: "share" })}
            >
              Share &amp; access
            </Button>
            <Button icon={Plus} onClick={() => setShowNewLink(true)}>
              New link
            </Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          label="Links"
          value={links.length}
          icon={Link2}
          iconBg="bg-primary-50"
          iconColor="text-primary-600"
          sublabel={platformCount ? `${platformCount} ${platformCount === 1 ? "platform" : "platforms"}` : undefined}
          loading={loading}
        />
        <StatCard
          label={hideBots ? "Genuine clicks" : "Total clicks"}
          value={totalClicks}
          icon={MousePointerClick}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sublabel={hideBots ? "bots hidden" : "incl. bots"}
          loading={loading || !linkClickCounts}
        />
        <StatCard
          label="Top link"
          value={topLink ? topLink.link_title : "—"}
          icon={Trophy}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sublabel={
            topLink && linkClickCounts
              ? `${formatNumber(linkClickCounts[topLink.id] ?? 0)} clicks`
              : undefined
          }
          loading={loading || !linkClickCounts}
        />
      </div>

      <section aria-labelledby="links-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="links-heading" className="text-lg font-semibold text-slate-900">
            Links
            {links.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-600">
                {formatNumber(links.length)}
              </span>
            )}
          </h2>
          {links.length > 1 && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <TitleSearchBar
                value={linkSearch}
                onChange={setLinkSearch}
                placeholder="Search links…"
                className="min-w-0 flex-1 sm:w-64 sm:flex-none"
              />
              <label htmlFor="link-sort" className="sr-only">
                Sort links
              </label>
              <Select
                id="link-sort"
                value={linkSort}
                onChange={(e) => setLinkSort(e.target.value as LinkSort)}
                fullWidth={false}
              >
                <option value="clicks">Most clicks</option>
                <option value="newest">Newest</option>
                <option value="edited">Recently edited</option>
                <option value="name">Name A–Z</option>
              </Select>
            </div>
          )}
        </div>

        {loading ? (
          <LoadingBlock label="Loading links">
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          </LoadingBlock>
        ) : links.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Create your first link"
            description="A link points to one destination (a video, product or page). Each creator then shares their own tracking URL for it, so you see exactly who drove each click."
            action={
              <Button icon={Plus} onClick={() => setShowNewLink(true)}>
                New link
              </Button>
            }
          />
        ) : filteredLinks.length === 0 ? (
          <EmptyState
            title={`No links match “${linkSearch.trim()}”`}
            action={
              <Button variant="secondary" onClick={() => setLinkSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <LinkList
            links={filteredLinks}
            onSelectLink={handleSelectLink}
            onDeleteLink={handleDeleteLink}
            onEditLink={setEditingLink}
            projectSlug={project.slug}
            brandSlug={brandSlug}
            clickCounts={linkClickCounts}
            clickCountTitle={hideBots ? "Genuine clicks (bots hidden)" : "All clicks"}
          />
        )}
      </section>

      <LinkFormDialog
        open={showNewLink}
        onClose={() => setShowNewLink(false)}
        shortCodePreview={newShortCode}
        onSubmit={(values) =>
          handleCreateLink(
            values.link_title,
            values.platform,
            values.destination_url,
            newShortCode,
            values.open_app_on_mobile,
            values.include_submission_in_url,
            { utm_enabled: values.utm_enabled, expires_at: values.expires_at }
          )
        }
      />

      <LinkFormDialog
        open={editingLink !== null}
        onClose={() => setEditingLink(null)}
        link={editingLink}
        onSubmit={(values) =>
          editingLink ? handleUpdateLink(editingLink.id, values) : Promise.resolve(false)
        }
      />

      <EditDetailsDialog
        open={showEditProject}
        onClose={() => setShowEditProject(false)}
        title="Edit project"
        nameLabel="Project name"
        initial={{ name: project.name, description: project.description ?? "" }}
        onSave={handleSaveProject}
      />

      <ShareAccessDialog
        open={shareDialog.open}
        initialTab={shareDialog.tab}
        onClose={() => setShareDialog((d) => ({ ...d, open: false }))}
        projectId={project.id}
        projectName={project.name}
        projectDescription={project.description}
        projectSlug={project.slug}
        projectUrl={projectUrl}
        accessToken={accessToken}
      />
    </AppPage>
  );
}

export function ProjectDetails({
  project,
  onProjectUpdated,
}: ProjectDetailsProps) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading project" />}>
      <ProjectDetailsContent
        project={project}
        onProjectUpdated={onProjectUpdated}
      />
    </Suspense>
  );
}
