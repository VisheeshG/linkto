"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project } from "@/lib/supabase";
import { ProjectDetails } from "@/components/ProjectDetails";

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 animate-pulse shadow-lg">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold text-lg">
            Loading project...
          </p>
          <p className="text-slate-500 text-sm mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl mb-6">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
            Project Not Found
          </h1>
          <p className="text-slate-600 mb-6 text-sm sm:text-base">
            {error ||
              "The requested project could not be found. It may have been deleted or you don't have access to it."}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProjectDetails project={project} onProjectUpdated={setProject} />
  );
}
