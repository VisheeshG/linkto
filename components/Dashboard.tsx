"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project, Brand } from "@/lib/supabase";
import { ProjectList, ProjectWithStats } from "./ProjectList";
import { BrandList, BrandWithStats } from "./BrandList";
import { DashboardStatsCards } from "./DashboardStatsCards";
import { TitleSearchBar } from "./TitleSearchBar";
import { NewProjectForm } from "./NewProjectForm";
import { NewBrandForm } from "./NewBrandForm";
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
import { LogOut, Plus, Briefcase } from "lucide-react";
import toast from "react-hot-toast";
import { BrandLogo } from "@/components/BrandLogo";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";

export function Dashboard() {
  const { user, signOut } = useAuth();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-4 animate-pulse shadow-lg p-2">
            <BrandLogo size={48} />
          </div>
          <p className="text-slate-700 font-semibold text-lg">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  const handleSelectProject = (project: Project) => {
    router.push(`/dashboard/${project.id}`);
  };

  const handleSelectBrand = (brand: Brand) => {
    router.push(`/dashboard/brands/${brand.id}`);
  };

  const hasAnyContent = brands.length > 0 || projects.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg p-1.5 sm:p-2">
                <BrandLogo
                  size={48}
                  priority
                  className="w-8 h-8 sm:w-10 sm:h-10"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Linkto
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  Branded links. Creator-level clarity.
                </p>
                <p className="text-xs sm:text-sm text-slate-600 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="group shrink-0 flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base text-slate-700 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md"
            >
              <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 lg:py-10">
        <DashboardStatsCards
          totalProjects={projects.length}
          totalLinks={totalLinks}
          totalClicks={totalClicks}
          clicksLabel={hideBots ? "Genuine Clicks" : "Total Clicks"}
          loading={statsLoading}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
              Dashboard
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              Organize campaigns by brand
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowNewBrand(true)}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all font-semibold shadow-lg w-full sm:w-auto"
            >
              <Briefcase className="w-5 h-5" />
              <span>New Brand</span>
            </button>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all font-semibold shadow-lg w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {!hasAnyContent ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              Get started
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Create a brand to group related projects, or add a project
              directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setShowNewBrand(true)}
                className="inline-flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-semibold"
              >
                <Briefcase className="w-5 h-5" />
                <span>Create Brand</span>
              </button>
              <button
                onClick={() => setShowNewProject(true)}
                className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold"
              >
                <Plus className="w-5 h-5" />
                <span>Create Project</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {brands.length > 0 && (
              <section className="mb-10">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  Your Brands
                </h3>
                <TitleSearchBar
                  value={brandSearch}
                  onChange={setBrandSearch}
                  placeholder="Search brands by name..."
                  className="mb-6 max-w-md"
                />
                {brandsWithStats.length === 0 && brandSearch.trim() ? (
                  <p className="text-slate-600 text-sm">
                    No brands match &quot;{brandSearch.trim()}&quot;.
                  </p>
                ) : (
                  <BrandList
                    brands={brandsWithStats}
                    onSelectBrand={handleSelectBrand}
                    onDeleteBrand={handleDeleteBrand}
                  />
                )}
              </section>
            )}

            <section>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Unbranded Projects
              </h3>
              {unbrandedProjects.length === 0 ? (
                <p className="text-sm text-slate-600 mb-4">
                  All projects are assigned to a brand. Open a brand to see them,
                  or create a new unbranded project.
                </p>
              ) : (
                <>
                  <TitleSearchBar
                    value={projectSearch}
                    onChange={setProjectSearch}
                    placeholder="Search projects by title..."
                    className="mb-6 max-w-md"
                  />
                  {filteredUnbrandedWithStats.length === 0 ? (
                    <p className="text-slate-600 text-sm">
                      No projects match &quot;{projectSearch.trim()}&quot;.
                    </p>
                  ) : (
                    <ProjectList
                      projects={filteredUnbrandedWithStats}
                      brands={brands}
                      onSelectProject={handleSelectProject}
                      onDeleteProject={handleDeleteProject}
                      onMoveToBrand={handleMoveToBrand}
                    />
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="clickable-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewProject(false)}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <NewProjectForm
              brands={brands}
              onSubmit={handleCreateProject}
              onCancel={() => setShowNewProject(false)}
            />
          </div>
        </div>
      )}

      {showNewBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="clickable-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewBrand(false)}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <NewBrandForm
              onSubmit={handleCreateBrand}
              onCancel={() => setShowNewBrand(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
