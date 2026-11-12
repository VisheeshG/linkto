import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { HowItWorksPlayer } from "@/components/landing/HowItWorksPlayer";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "How it works: from a creator's link to a paid order",
  description:
    "A 30-second walkthrough of how Linkto credits visits, signups and purchases to the creator who drove them, without a referral system.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <div className="landing-page flex min-h-screen flex-col bg-[#07070b] text-white">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${siteConfig.name} home`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 p-1.5 ring-1 ring-white/10">
            <BrandLogo size={36} priority className="h-full w-full" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>
        </Link>
        <Link
          href="/signup"
          className="ml-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Start free
        </Link>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-4 sm:px-6 sm:pt-8">
        <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold tracking-tight sm:text-4xl">
          How Linkto tracks a creator&apos;s link from click to purchase
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base text-slate-300">
          No referral codes, coupons or affiliate software on the brand&apos;s side. One pasted
          snippet is enough.
        </p>
        <div className="mt-8">
          <HowItWorksPlayer />
        </div>
        <p className="mt-8 text-center text-sm text-slate-300">
          Ready to set it up?{" "}
          <Link href="/guide" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Follow the copy-paste integration guide
          </Link>
          {" · "}
          <a
            href="/videos/linkto-how-it-works.mp4"
            download
            className="font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Download this as a video (MP4)
          </a>
        </p>
      </main>
    </div>
  );
}
