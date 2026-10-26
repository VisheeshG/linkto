"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Brand, Project } from "@/lib/supabase";
import { DashboardStatsCards } from "./DashboardStatsCards";
import { ProjectList, ProjectWithStats } from "./ProjectList";
import { TitleSearchBar } from "./TitleSearchBar";
import { NewProjectDialog } from "./dashboard/NewProjectDialog";
import { EditDetailsDialog } from "./project/EditDetailsDialog";
import { AppPage, PageNotFound, PageSkeleton } from "./app/AppPage";
import { Button, EmptyState, PageHeader, TabPanel, Tabs } from "./ui";
import { formatRelative } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";
import { BrandAnalyticsPanel } from "./BrandAnalyticsPanel";
import { matchesTitleQuery } from "@/lib/search";
import { isValidSlug } from "@/lib/slug-utils";
import {
  isBrandSlugUniqueForUser,
  isProjectSlugUnique,
} from "@/lib/generators";
import {
  fetchStatsForProjectIds,
  fetchStatsMapForProjectIds,
} from "@/lib/project-stats";
import { BarChart3, Briefcase, FolderOpen, Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";

interface BrandDetailProps {
  brandId: string;
}

export function BrandDetail({ brandId }: BrandDetailProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [totalLinks, setTotalLinks] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [showEditBrand, setShowEditBrand] = useState(false);
  const [tab, setTab] = useState<"projects" | "analytics">("projects");

  const brandProjects = useMemo(
    () => projects.filter((p) => p.brand_id === brandId),
    [projects, brandId]
  );

  const [hideBots] = useHideBotClicks();
  const [projectStatsMap, setProjectStatsMap] = useState<
    Record<string, { linkCount: number; clickCount: number }>
  >({});

  useEffect(() => {
    let cancelled = false;
    const ids = brandProjects.map((p) => p.id);

    if (ids.length === 0) {
      setProjectStatsMap({});
      return;
    }

    void fetchStatsMapForProjectIds(ids, { humanOnly: hideBots }).then((map) => {
      if (!cancelled) setProjectStatsMap(map);
    });

    return () => {
      cancelled = true;
    };
  }, [brandProjects, hideBots]);

  const filteredProjectsWithStats = useMemo((): ProjectWithStats[] => {
    return brandProjects
      .filter((p) => matchesTitleQuery(projectSearch, p.name))
      .map((p) => ({
        ...p,
        linkCount: projectStatsMap[p.id]?.linkCount ?? 0,
        clickCount: projectStatsMap[p.id]?.clickCount ?? 0,
      }));
  }, [brandProjects, projectSearch, projectStatsMap]);

  const loadData = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      const [brandRes, brandsRes, projectsRes] = await Promise.all([
        supabase
          .from("brands")
          .select("*")
          .eq("id", brandId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("brands")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (brandRes.error) throw brandRes.error;
      if (brandsRes.error) throw brandsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setBrand(brandRes.data);
      setBrands(brandsRes.data || []);
      const allProjects = (projectsRes.data || []).map((p) => ({
        ...p,
        brand_id: p.brand_id ?? null,
      }));
      setProjects(allProjects);

      const ids = allProjects
        .filter((p) => p.brand_id === brandId)
        .map((p) => p.id);
      const stats = await fetchStatsForProjectIds(ids, { humanOnly: hideBots });
      setTotalLinks(stats.linkCount);
      setTotalClicks(stats.clickCount);
    } catch (error) {
      console.error("Error loading brand:", error);
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  }, [user, brandId, hideBots]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveBrand = async (values: {
    name: string;
    description: string;
    slug?: string;
  }): Promise<boolean> => {
    if (!brand || !user) return false;
    const nextSlug = values.slug ?? brand.slug;
    try {
      if (nextSlug !== brand.slug) {
        const unique = await isBrandSlugUniqueForUser(nextSlug, user.id, supabase, brand.id);
        if (!unique) {
          toast.error(`You already have a brand using “${nextSlug}”.`);
          return false;
        }
      }

      const { data, error } = await supabase
        .from("brands")
        .update({
          name: values.name,
          slug: nextSlug,
          description: values.description || null,
        })
        .eq("id", brand.id)
        .select()
        .single();

      if (error) throw error;
      setBrand(data);
      setBrands(brands.map((b) => (b.id === data.id ? data : b)));
      toast.success(
        nextSlug !== brand.slug
          ? "Brand updated. Tracking URLs with the old slug no longer work."
          : "Brand updated"
      );
      return true;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error updating brand");
      return false;
    }
  };

  const handleCreateProject = async (
    name: string,
    description: string,
    slug: string,
    selectedBrandId: string | null
  ) => {
    if (!user) return false;

    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        toast.error("Project name is required");
        return false;
      }

      const { data: existingProjects, error: existingError } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .ilike("name", trimmedName);

      if (existingError) throw existingError;
      if (existingProjects && existingProjects.length > 0) {
        toast.error("A project with this name already exists.");
        return false;
      }

      const trimmedSlug = slug.trim();
      if (!(await isProjectSlugUnique(trimmedSlug, supabase))) {
        toast.error(`Project slug "${trimmedSlug}" is already taken.`);
        return false;
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: trimmedName,
          description: description.trim() || null,
          slug: trimmedSlug,
          brand_id: selectedBrandId ?? brandId,
        })
        .select()
        .single();

      if (error) throw error;

      const normalized = { ...data, brand_id: data.brand_id ?? null };
      setProjects([normalized, ...projects]);
      setShowNewProject(false);
      await loadData();
      router.push(`/dashboard/${data.id}`);
      return true;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error creating project"
      );
      return false;
    }
  };

  const handleMoveToBrand = async (
    projectId: string,
    targetBrandId: string | null
  ) => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .update({ brand_id: targetBrandId })
        .eq("id", projectId)
        .select()
        .single();

      if (error) throw error;

      if (targetBrandId !== brandId) {
        router.push("/dashboard");
        toast.success(
          targetBrandId ? "Project moved" : "Project moved to Unbranded"
        );
        return;
      }

      setProjects(
        projects.map((p) =>
          p.id === projectId
            ? { ...p, brand_id: data.brand_id ?? null }
            : p
        )
      );
      await loadData();
      toast.success("Project updated");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error moving project"
      );
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("You must be signed in to delete a project");
        return;
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Error deleting project"
        );
      }

      setProjects(projects.filter((p) => p.id !== projectId));
      await loadData();
      toast.success("Project deleted");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error deleting project"
      );
    }
  };

  if (loading) {
    return <PageSkeleton label="Loading brand" />;
  }

  if (!brand) {
    return (
      <PageNotFound
        title="Brand not found"
        description="It may have been deleted, or it belongs to a different account."
        crumbs={[{ label: "Dashboard", href: "/dashboard" }]}
      />
    );
  }

  const host = siteConfig.url.replace(/^https?:\/\//, "");
  const edited = formatRelative(brand.updated_at || brand.created_at);

  return (
    <AppPage crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: brand.name }]}>
      <PageHeader
        icon={
          <div aria-hidden className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 sm:flex">
            <Briefcase className="h-6 w-6" />
          </div>
        }
        title={brand.name}
        meta={
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            label="Edit brand details"
            onClick={() => setShowEditBrand(true)}
          />
        }
        description={
          <>
            {brand.description && <p>{brand.description}</p>}
            <p className="mt-1 text-xs text-slate-600">
              <span className="font-mono">{host}/{brand.slug}/…</span>
              {edited ? ` · Edited ${edited}` : ""}
            </p>
          </>
        }
        actions={
          <Button icon={Plus} onClick={() => setShowNewProject(true)}>
            New project
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: "projects", label: "Projects", icon: FolderOpen, count: brandProjects.length },
          { id: "analytics", label: "Analytics", icon: BarChart3 },
        ]}
        value={tab}
        onChange={setTab}
        idPrefix="brand"
        label="Brand sections"
        className="mb-6"
      />

      <TabPanel id="projects" active={tab} idPrefix="brand">
        <DashboardStatsCards
          totalProjects={brandProjects.length}
          totalLinks={totalLinks}
          totalClicks={totalClicks}
          clicksLabel={hideBots ? "Genuine clicks" : "Total clicks"}
          loading={statsLoading}
        />

        {brandProjects.length > 3 && (
          <TitleSearchBar
            value={projectSearch}
            onChange={setProjectSearch}
            placeholder="Search projects…"
            className="mb-4 w-full sm:w-72"
          />
        )}

        {brandProjects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects in this brand yet"
            description="Projects are campaigns. Each gets its own links, analytics and shareable client report."
            action={
              <Button icon={Plus} onClick={() => setShowNewProject(true)}>
                New project
              </Button>
            }
          />
        ) : filteredProjectsWithStats.length === 0 ? (
          <EmptyState
            title={`No projects match “${projectSearch.trim()}”`}
            action={
              <Button variant="secondary" onClick={() => setProjectSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <ProjectList
            projects={filteredProjectsWithStats}
            brands={brands}
            onSelectProject={(p) => router.push(`/dashboard/${p.id}`)}
            onDeleteProject={handleDeleteProject}
            onMoveToBrand={handleMoveToBrand}
          />
        )}
      </TabPanel>

      <TabPanel id="analytics" active={tab} idPrefix="brand">
        <BrandAnalyticsPanel
          projectIds={brandProjects.map((p) => p.id)}
          projects={brandProjects}
          brandSlug={brand.slug}
        />
      </TabPanel>

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        brands={brands}
        defaultBrandId={brandId}
        onSubmit={handleCreateProject}
      />

      <EditDetailsDialog
        open={showEditBrand}
        onClose={() => setShowEditBrand(false)}
        title="Edit brand"
        nameLabel="Brand name"
        initial={{ name: brand.name, description: brand.description ?? "", slug: brand.slug }}
        slug={{
          prefix: `${host}/`,
          hint: "changing it breaks branded links already shared",
          validate: (value) =>
            isValidSlug(value) ? null : "Use 2–48 lowercase letters, numbers and single hyphens.",
        }}
        onSave={handleSaveBrand}
      />
    </AppPage>
  );
}
