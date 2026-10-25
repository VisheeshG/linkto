"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Brand, Project } from "@/lib/supabase";
import { DashboardStatsCards } from "./DashboardStatsCards";
import { ProjectList, ProjectWithStats } from "./ProjectList";
import { TitleSearchBar } from "./TitleSearchBar";
import { NewProjectForm } from "./NewProjectForm";
import { BrandAnalyticsPanel } from "./BrandAnalyticsPanel";
import { matchesTitleQuery } from "@/lib/search";
import { isValidSlug } from "@/lib/slug-utils";
import {
  isBrandSlugUniqueForUser,
  isProjectSlugUnique,
} from "@/lib/generators";
import { LastEditedLabel } from "./LastEditedLabel";
import {
  fetchStatsForProjectIds,
  fetchStatsMapForProjectIds,
} from "@/lib/project-stats";
import { ArrowLeft, Plus, Briefcase, Pencil } from "lucide-react";
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
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingBrand, setIsSavingBrand] = useState(false);

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
      setEditName(brandRes.data.name);
      setEditSlug(brandRes.data.slug);
      setEditDescription(brandRes.data.description ?? "");
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

  const resetBrandEditFields = (b: Brand) => {
    setEditName(b.name);
    setEditSlug(b.slug);
    setEditDescription(b.description ?? "");
  };

  const handleSaveBrand = async () => {
    if (!brand || !user) return;
    const trimmedName = editName.trim();
    const trimmedSlug = editSlug.trim().toLowerCase();
    const trimmedDescription = editDescription.trim();

    if (!trimmedName) {
      toast.error("Brand name is required");
      return;
    }

    if (!isValidSlug(trimmedSlug)) {
      toast.error(
        "Brand URL slug must be 2–48 characters: lowercase letters, numbers, and hyphens only."
      );
      return;
    }

    setIsSavingBrand(true);
    try {
      if (trimmedSlug !== brand.slug) {
        const unique = await isBrandSlugUniqueForUser(
          trimmedSlug,
          user.id,
          supabase,
          brand.id
        );
        if (!unique) {
          toast.error(`Brand slug "${trimmedSlug}" is already in use.`);
          return;
        }
      }

      const { data, error } = await supabase
        .from("brands")
        .update({
          name: trimmedName,
          slug: trimmedSlug,
          description: trimmedDescription || null,
        })
        .eq("id", brand.id)
        .select()
        .single();

      if (error) throw error;
      setBrand(data);
      setBrands(brands.map((b) => (b.id === data.id ? data : b)));
      setIsEditingBrand(false);
      if (trimmedSlug !== brand.slug) {
        toast.success(
          "Brand updated. Old tracking URLs using the previous slug will stop working."
        );
      } else {
        toast.success("Brand updated");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error updating brand"
      );
    } finally {
      setIsSavingBrand(false);
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-50 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Loading brand...</p>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Brand not found</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-violet-600 font-semibold hover:underline"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-slate-600 hover:text-violet-600 mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              {isEditingBrand ? (
                <div className="space-y-3 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Brand name
                    </label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-lg font-bold border-2 border-violet-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Brand URL slug
                    </label>
                    <input
                      value={editSlug}
                      onChange={(e) =>
                        setEditSlug(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                        )
                      }
                      className={`w-full font-mono border-2 rounded-lg px-3 py-2 ${
                        editSlug && !isValidSlug(editSlug)
                          ? "border-amber-400 bg-amber-50"
                          : "border-violet-300"
                      }`}
                    />
                    {editSlug !== brand.slug && (
                      <p className="text-xs text-amber-700 mt-1 font-medium">
                        Changing the slug breaks existing branded links that use{" "}
                        <span className="font-mono">{brand.slug}</span>.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Description{" "}
                      <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full border-2 border-violet-300 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveBrand}
                      disabled={isSavingBrand}
                      className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg font-semibold disabled:opacity-50"
                    >
                      {isSavingBrand ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingBrand(false);
                        resetBrandEditFields(brand);
                      }}
                      disabled={isSavingBrand}
                      className="px-4 py-2 bg-slate-100 text-sm rounded-lg font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
                    {brand.name}
                  </h1>
                  <button
                    onClick={() => {
                      resetBrandEditFields(brand);
                      setIsEditingBrand(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg cursor-pointer"
                    aria-label="Edit brand"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
              {!isEditingBrand && (
                <>
                  <p className="text-sm text-slate-500 mt-1 font-mono">
                    linkto.in/{brand.slug}/…
                  </p>
                  {brand.description && (
                    <p className="text-slate-600 mt-1">{brand.description}</p>
                  )}
                  <LastEditedLabel
                    updatedAt={brand.updated_at}
                    createdAt={brand.created_at}
                    className="mt-2"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-8">
        <DashboardStatsCards
          totalProjects={brandProjects.length}
          totalLinks={totalLinks}
          totalClicks={totalClicks}
          clicksLabel={hideBots ? "Genuine Clicks" : "Total Clicks"}
          loading={statsLoading}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-900">Projects</h2>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        {brandProjects.length > 0 && (
          <TitleSearchBar
            value={projectSearch}
            onChange={setProjectSearch}
            placeholder="Search projects in this brand..."
            className="mb-6 max-w-md"
          />
        )}

        {brandProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center mb-10">
            <p className="text-slate-600 mb-4">No projects in this brand yet.</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="text-blue-600 font-semibold hover:underline"
            >
              Create a project
            </button>
          </div>
        ) : filteredProjectsWithStats.length === 0 ? (
          <p className="text-slate-600 mb-10">No projects match your search.</p>
        ) : (
          <div className="mb-10">
            <ProjectList
              projects={filteredProjectsWithStats}
              brands={brands}
              onSelectProject={(p) => router.push(`/dashboard/${p.id}`)}
              onDeleteProject={handleDeleteProject}
              onMoveToBrand={handleMoveToBrand}
            />
          </div>
        )}

        <BrandAnalyticsPanel
          projectIds={brandProjects.map((p) => p.id)}
          projects={brandProjects}
          brandSlug={brand.slug}
        />
      </main>

      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="clickable-backdrop absolute inset-0 bg-black/60"
            onClick={() => setShowNewProject(false)}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <NewProjectForm
              brands={brands}
              defaultBrandId={brandId}
              onSubmit={handleCreateProject}
              onCancel={() => setShowNewProject(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
