"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project, Brand } from "@/lib/supabase";
import { ProjectList, ProjectWithStats } from "./ProjectList";
import { BrandList, BrandWithStats } from "./BrandList";
import { DashboardStatsCards } from "./DashboardStatsCards";
import { TitleSearchBar } from "./TitleSearchBar";
import { NewProjectDialog } from "./dashboard/NewProjectDialog";
import { NewBrandDialog } from "./dashboard/NewBrandDialog";
import { AppPage } from "./app/AppPage";
import {
  Button,
  DropdownMenu,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Skeleton,
  buttonClasses,
} from "./ui";
import { matchesTitleQuery } from "@/lib/search";
import {
  fetchStatsForProjectIds,
  fetchStatsMapForProjectIds,
} from "@/lib/project-stats";
import {
  generateUniqueBrandSlug,
  isProjectSlugUnique,
} from "@/lib/generators";
import { isValidSlug, slugifyName } from "@/lib/slug-utils";
import { Briefcase, ChevronDown, FolderPlus, Link2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";

export function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [totalLinks, setTotalLinks] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  const unbrandedProjects = useMemo(
    () => projects.filter((p) => !p.brand_id),
    [projects]
  );

  const matchedBrands = useMemo(
    () => brands.filter((b) => matchesTitleQuery(brandSearch, b.name)),
    [brands, brandSearch]
  );

  const [brandsWithStats, setBrandsWithStats] = useState<BrandWithStats[]>([]);
  const [hideBots] = useHideBotClicks();

  useEffect(() => {
    let cancelled = false;

    const loadBrandStats = async () => {
      const withStats: BrandWithStats[] = await Promise.all(
        matchedBrands.map(async (brand) => {
          const brandProjects = projects.filter((p) => p.brand_id === brand.id);
          const stats = await fetchStatsForProjectIds(
            brandProjects.map((p) => p.id),
            { humanOnly: hideBots }
          );
          return {
            ...brand,
            projectCount: brandProjects.length,
            linkCount: stats.linkCount,
            clickCount: stats.clickCount,
          };
        })
      );
      if (!cancelled) setBrandsWithStats(withStats);
    };

    if (matchedBrands.length === 0) {
      setBrandsWithStats([]);
      return;
    }

    void loadBrandStats();
    return () => {
      cancelled = true;
    };
  }, [matchedBrands, projects, hideBots]);

  const [unbrandedStatsMap, setUnbrandedStatsMap] = useState<
    Record<string, { linkCount: number; clickCount: number }>
  >({});

  useEffect(() => {
    let cancelled = false;
    const ids = unbrandedProjects.map((p) => p.id);

    if (ids.length === 0) {
      setUnbrandedStatsMap({});
      return;
    }

    void fetchStatsMapForProjectIds(ids, { humanOnly: hideBots }).then((map) => {
      if (!cancelled) setUnbrandedStatsMap(map);
    });

    return () => {
      cancelled = true;
    };
  }, [unbrandedProjects, hideBots]);

  const filteredUnbrandedWithStats = useMemo((): ProjectWithStats[] => {
    return unbrandedProjects
      .filter((p) => matchesTitleQuery(projectSearch, p.name))
      .map((p) => ({
        ...p,
        linkCount: unbrandedStatsMap[p.id]?.linkCount ?? 0,
        clickCount: unbrandedStatsMap[p.id]?.clickCount ?? 0,
      }));
  }, [unbrandedProjects, projectSearch, unbrandedStatsMap]);

  const loadDashboardStats = useCallback(async (projectIds: string[]) => {
    setStatsLoading(true);
    try {
      const stats = await fetchStatsForProjectIds(projectIds, {
        humanOnly: hideBots,
      });
      setTotalLinks(stats.linkCount);
      setTotalClicks(stats.clickCount);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [hideBots]);

  const loadData = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      const [brandsRes, projectsRes] = await Promise.all([
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

      if (brandsRes.error) throw brandsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      const projectList = (projectsRes.data || []).map((p) => ({
        ...p,
        brand_id: p.brand_id ?? null,
      }));
      setBrands(brandsRes.data || []);
      setProjects(projectList);
      await loadDashboardStats(projectList.map((p) => p.id));
    } catch (error) {
      console.error("Error loading dashboard:", error);
      setStatsLoading(false);
    } finally {
      setLoading(false);
    }
  }, [user, loadDashboardStats]);

  useEffect(() => {
    loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (!showNewProject && !showNewBrand) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNewProject(false);
        setShowNewBrand(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showNewProject, showNewBrand]);

  const handleCreateBrand = async (
    name: string,
    description: string,
    slugInput: string
  ) => {
    if (!user) return false;

    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        toast.error("Brand name is required");
        return false;
      }

      const trimmedSlug = (slugInput.trim() || slugifyName(trimmedName)).toLowerCase();
      if (!isValidSlug(trimmedSlug)) {
        toast.error(
          "Brand URL slug must be 2–48 characters: lowercase letters, numbers, and hyphens only."
        );
        return false;
      }

      const { data: existing, error: existingError } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .ilike("name", trimmedName);

      if (existingError) throw existingError;
      if (existing && existing.length > 0) {
        toast.error("A brand with this name already exists.");
        return false;
      }

      const slugUnique = await generateUniqueBrandSlug(trimmedName, user.id, supabase);
      const finalSlug =
        trimmedSlug === slugifyName(trimmedName) ? slugUnique : trimmedSlug;

      const { data: slugTaken } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .eq("slug", finalSlug)
        .maybeSingle();

      if (slugTaken) {
        toast.error(`Brand slug "${finalSlug}" is already in use.`);
        return false;
      }

      const { data, error } = await supabase
        .from("brands")
        .insert({
          user_id: user.id,
          name: trimmedName,
          slug: finalSlug,
          description: description.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setBrands([data, ...brands]);
      setShowNewBrand(false);
      toast.success("Brand created");
      return true;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error creating brand"
      );
      return false;
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    try {
      const { error } = await supabase.from("brands").delete().eq("id", brandId);
      if (error) throw error;

      setBrands(brands.filter((b) => b.id !== brandId));
      const updatedProjects = projects.map((p) =>
        p.brand_id === brandId ? { ...p, brand_id: null } : p
      );
      setProjects(updatedProjects);
      toast.success("Brand deleted. Projects moved to Unbranded.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error deleting brand"
      );
    }
  };

  const handleCreateProject = async (
    name: string,
    description: string,
    slug: string,
    brandId: string | null
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
      if (!trimmedSlug) {
        toast.error("Project slug is required");
        return false;
      }

      if (!(await isProjectSlugUnique(trimmedSlug, supabase))) {
        toast.error(
          `Project slug "${trimmedSlug}" is already taken. Choose a different slug.`,
          { duration: 5000 }
        );
        return false;
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: trimmedName,
          description: description.trim() || null,
          slug: trimmedSlug,
          brand_id: brandId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505" && error.message.includes("slug")) {
          toast.error(
            `Project slug "${trimmedSlug}" is already taken. Choose a different slug.`,
            { duration: 5000 }
          );
          return false;
        }
        throw error;
      }

      const normalized = { ...data, brand_id: data.brand_id ?? null };
      setProjects([normalized, ...projects]);
      setShowNewProject(false);
      await loadDashboardStats([normalized, ...projects].map((p) => p.id));
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
    brandId: string | null
  ) => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .update({ brand_id: brandId })
        .eq("id", projectId)
        .select()
        .single();

      if (error) throw error;

      setProjects(
        projects.map((p) =>
          p.id === projectId
            ? { ...p, brand_id: data.brand_id ?? null }
            : p
        )
      );
      toast.success(brandId ? "Project moved to brand" : "Project unbranded");
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

      const remaining = projects.filter((p) => p.id !== projectId);
      setProjects(remaining);
      await loadDashboardStats(remaining.map((p) => p.id));
      toast.success("Project and all associated data deleted successfully");
    } catch (error: unknown) {
      console.error("Error deleting project:", error);
      toast.error(
        error instanceof Error ? error.message : "Error deleting project"
      );
    }
  };

  const handleSelectProject = (project: Project) => {
    router.push(`/dashboard/${project.id}`);
  };

  const handleSelectBrand = (brand: Brand) => {
    router.push(`/dashboard/brands/${brand.id}`);
  };

  const hasAnyContent = brands.length > 0 || projects.length > 0;

  const newMenu = (
    <DropdownMenu
      label="Create"
      items={[
        {
          label: "New project",
          description: "A campaign with its own links",
          icon: FolderPlus,
          onSelect: () => setShowNewProject(true),
        },
        {
          label: "New brand",
          description: "Groups projects; appears in URLs",
          icon: Briefcase,
          onSelect: () => setShowNewBrand(true),
        },
      ]}
      trigger={(props) => (
        <button {...props} type="button" className={buttonClasses({ variant: "primary" })}>
          <Plus className="h-[18px] w-[18px]" aria-hidden />
          New
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      )}
    />
  );

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;

  return (
    <AppPage>
      <PageHeader
        title={firstName ? `Hi, ${firstName}` : "Dashboard"}
        description="Your brands and campaigns at a glance."
        actions={newMenu}
      />

      <DashboardStatsCards
        totalProjects={projects.length}
        totalLinks={totalLinks}
        totalClicks={totalClicks}
        clicksLabel={hideBots ? "Genuine clicks" : "Total clicks"}
        loading={statsLoading}
      />

      {loading ? (
        <LoadingBlock label="Loading brands and projects">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </LoadingBlock>
      ) : !hasAnyContent ? (
        <section aria-labelledby="get-started" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 id="get-started" className="text-lg font-semibold text-slate-900">
            Get started in three steps
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Briefcase, title: "Create a brand", text: "Optional. Groups campaigns and shows in URLs, e.g. linkto.in/acme/…" },
              { icon: FolderPlus, title: "Add a project", text: "One campaign, like “Diwali launch”. Share its live report with clients." },
              { icon: Link2, title: "Create links", text: "One per destination. Each creator shares their own tracking URL." },
            ].map((step, i) => (
              <li key={step.title} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <step.icon className="h-4 w-4 text-slate-600" aria-hidden />
                  <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="mt-2 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button icon={FolderPlus} onClick={() => setShowNewProject(true)}>
              New project
            </Button>
            <Button variant="secondary" icon={Briefcase} onClick={() => setShowNewBrand(true)}>
              New brand
            </Button>
          </div>
        </section>
      ) : (
        <div className="space-y-10">
          {brands.length > 0 && (
            <section aria-labelledby="brands-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id="brands-heading" className="text-lg font-semibold text-slate-900">
                  Brands
                  <span className="ml-2 text-sm font-normal text-slate-600">{brands.length}</span>
                </h2>
                {brands.length > 3 && (
                  <TitleSearchBar
                    value={brandSearch}
                    onChange={setBrandSearch}
                    placeholder="Search brands…"
                    className="w-full sm:w-64"
                  />
                )}
              </div>
              {brandsWithStats.length === 0 && brandSearch.trim() ? (
                <EmptyState
                  title={`No brands match “${brandSearch.trim()}”`}
                  action={
                    <Button variant="secondary" onClick={() => setBrandSearch("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <BrandList
                  brands={brandsWithStats}
                  onSelectBrand={handleSelectBrand}
                  onDeleteBrand={handleDeleteBrand}
                />
              )}
            </section>
          )}

          <section aria-labelledby="unbranded-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="unbranded-heading" className="text-lg font-semibold text-slate-900">
                Projects without a brand
                {unbrandedProjects.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-600">{unbrandedProjects.length}</span>
                )}
              </h2>
              {unbrandedProjects.length > 3 && (
                <TitleSearchBar
                  value={projectSearch}
                  onChange={setProjectSearch}
                  placeholder="Search projects…"
                  className="w-full sm:w-64"
                />
              )}
            </div>
            {unbrandedProjects.length === 0 ? (
              <p className="text-sm text-slate-600">
                Every project belongs to a brand. Open a brand to see its projects.
              </p>
            ) : filteredUnbrandedWithStats.length === 0 ? (
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
                projects={filteredUnbrandedWithStats}
                brands={brands}
                onSelectProject={handleSelectProject}
                onDeleteProject={handleDeleteProject}
                onMoveToBrand={handleMoveToBrand}
              />
            )}
          </section>
        </div>
      )}

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        brands={brands}
        onSubmit={handleCreateProject}
      />
      <NewBrandDialog
        open={showNewBrand}
        onClose={() => setShowNewBrand(false)}
        onSubmit={handleCreateBrand}
      />
    </AppPage>
  );
}
