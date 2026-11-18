"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LinktoLanding } from "./LinktoLanding";

function HomePageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  // The landing page is rendered straight away (and on the server) so search
  // engines and link previews see it; signed-in visitors are then sent on.
  if (user) return null;

  return <LinktoLanding />;
}

export function HomePageClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
