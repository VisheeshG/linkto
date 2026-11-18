import type { Metadata } from "next";
import { defaultTitle, siteConfig } from "@/lib/site-config";
import { HomePageClient } from "@/components/landing/HomePageClient";

export const metadata: Metadata = {
  title: defaultTitle,
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: defaultTitle,
    description: siteConfig.description,
    url: "/",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
