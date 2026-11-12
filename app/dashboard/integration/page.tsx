"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { IntegrationPage } from "@/components/integration/IntegrationPage";
import { PageSkeleton } from "@/components/app/AppPage";

export default function IntegrationRoute() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <PageSkeleton label="Loading conversion tracking" />;
  }

  return <IntegrationPage />;
}
