"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project } from "@/lib/supabase";
import { ProjectDetails } from "@/components/ProjectDetails";
import { PageNotFound, PageSkeleton } from "@/components/app/AppPage";

export default function ProjectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = params.projectId as string;

  useEffect(() => {
    if (!loading && !user && projectId) {
      // Projects are private to their owner; anonymous visitors log in first.
      router.replace("/login");
    }
  }, [loading, user, router, projectId]);

  // Reset when navigating to a different project
  useEffect(() => {
    setProject(null);
    setProjectLoading(true);
    setError(null);
  }, [projectId]);

  useEffect(() => {
    if (!user?.id || !projectId) return;

    let cancelled = false;

    const loadProject = async () => {
      try {
        setError(null);

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("user_id", user.id)
          .single();

        if (cancelled) return;

        if (error) {
          console.error("Error loading project:", error);
          setError("Project not found");
          return;
        }

        if (!data) {
          setError("Project not found");
          return;
        }

        setProject(data);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading project:", err);
        setError("Failed to load project");
      } finally {
        if (!cancelled) setProjectLoading(false);
      }
    };

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [user?.id, projectId]);

  // Full-page loader only on initial load (keeps modals open on tab switch / token refresh)
  if (loading || (projectLoading && !project)) {
    return <PageSkeleton label="Loading project" />;
  }

  if (!user) {
    return null;
  }

  if (error || !project) {
    return (
      <PageNotFound
        title="Project not found"
        description={
          error && error !== "Project not found"
            ? error
            : "It may have been deleted, or it belongs to a different account."
        }
      />
    );
  }

  return (
    <ProjectDetails project={project} onProjectUpdated={setProject} />
  );
}
