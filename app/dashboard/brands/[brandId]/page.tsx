"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { BrandDetail } from "@/components/BrandDetail";
import { PageSkeleton } from "@/components/app/AppPage";

export default function BrandPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const brandId = params.brandId as string;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <PageSkeleton label="Loading brand" />;
  }

  return <BrandDetail brandId={brandId} />;
}
