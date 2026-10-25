"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  FileSpreadsheet,
  Link2,
  Lock,
  Mic,
  Minus,
  Play,
  Share2,
  Smartphone,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { BrandedUrlDemo } from "./BrandedUrlDemo";
import { HeroDashboard } from "./HeroDashboard";
import {
  COMPARISON_ROWS,
  LOGO_NAMES,
  STATS,
  TESTIMONIALS,
} from "./landing-data";

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-lg bg-slate-900 p-1.5 ring-1 ring-white/10">
            <Image
              src="/logo.png"
              alt="Linkto"
              width={36}
              height={36}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">
            Linkto
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#compare" className="hover:text-white transition-colors">
            Compare
          </a>
          <a href="#use-cases" className="hover:text-white transition-colors">
            Use cases
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 text-sm font-semibold px-4 py-2 hover:bg-slate-100 transition-colors shadow-lg shadow-white/10"
          >
            Start free
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function PrimaryCta({
  large = false,
  className = "",
}: {
  large?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/signup"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 transition-all ${
        large ? "px-8 py-3.5 text-base" : "px-6 py-2.5 text-sm"
      } ${className}`}
    >
      Start Tracking Free
      <ArrowRight className={large ? "h-5 w-5" : "h-4 w-4"} />
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 mb-4">
      {children}
    </p>
  );
}

export function LinktoLanding() {
  return (
    <div className="landing-page bg-[#fafafa] text-slate-900 antialiased">
      <Nav />

      {/* Hero */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 overflow-hidden bg-[#0a0a0f] text-white">
        <div
          className="absolute inset-0 landing-grid opacity-[0.35]"
          aria-hidden
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-cyan-500/20 via-blue-600/10 to-transparent blur-3xl pointer-events-none"
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center landing-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Creator Analytics Platform
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
              Stop guessing which creators drive results.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Track every creator, every campaign, and every click using clean
              branded links that actually tell you what&apos;s working.
            </p>
            <p className="mt-4 text-sm text-slate-500 space-y-1">
              <span className="block">No spreadsheets.</span>
              <span className="block">No messy UTMs.</span>
              <span className="block">No manual reporting.</span>
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <PrimaryCta large />
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch Demo
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Branded links. Creator-level clarity.
            </p>
          </div>

          <div id="demo" className="mt-16 sm:mt-20 landing-fade-up-delay">
            <BrandedUrlDemo />
            <div className="mt-12">
              <HeroDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-16 sm:py-20 border-b border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Trusted by modern creator marketing teams
          </h2>
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {LOGO_NAMES.map((name) => (
              <span
                key={name}
                className="text-sm font-semibold text-slate-500"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 sm:py-28 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel>The problem</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Creator marketing shouldn&apos;t require detective work.
            </h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Bitly shows clicks",
                body: "But not which creator generated them.",
                icon: Link2,
              },
              {
                title: "UTMs become a mess",
                body: "Hundreds of links. Broken spreadsheets. Manual reporting.",
                icon: FileSpreadsheet,
              },
              {
                title: "Agencies waste hours",
                body: "Building reports instead of optimizing campaigns.",
                icon: BarChart3,
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center mb-5">
                  <card.icon className="h-5 w-5 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
                <p className="mt-3 text-slate-600 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-20 sm:py-28 bg-white border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <SectionLabel>The solution</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              See exactly where every click came from.
            </h2>
          </div>

          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 flex-wrap">
            {[
              { label: "Creator", icon: Users },
              { label: "Linkto URL", icon: Link2 },
              { label: "Click tracking", icon: Zap },
              { label: "Analytics dashboard", icon: BarChart3 },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-4 sm:gap-6">
                <div className="flex flex-col items-center text-center">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <step.icon className="h-6 w-6 text-white" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    {step.label}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-slate-300 hidden sm:block rotate-90 sm:rotate-0" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Creator attribution",
                body: "Know exactly who generated every click.",
              },
              {
                title: "Branded URLs",
                body: "Look professional with custom campaign links.",
              },
              {
                title: "Campaign analytics",
                body: "Creator, location, device, browser, and platform insights.",
              },
              {
                title: "Shareable reports",
                body: "Export PDF and Excel reports in seconds.",
              },
            ].map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-slate-200/80 p-6 bg-[#fafafa]"
              >
                <Check className="h-5 w-5 text-cyan-600 mb-3" />
                <h3 className="font-bold text-slate-900">{b.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-24">
          {[
            {
              tag: "Attribution",
              title: "Track creators automatically",
              body: "Every creator gets their own unique URL segment — attribution is built into the link, not bolted on with UTMs.",
              example: "linkto.in/nike/launch/abc123/john_doe",
              visual: "creators",
            },
            {
              tag: "Analytics",
              title: "Beautiful analytics",
              body: "Top creators, locations, devices, platforms, and campaigns — filtered by date range and exportable in one click.",
              visual: "analytics",
              reverse: true,
            },
            {
              tag: "Agencies",
              title: "Built for agencies",
              body: "Manage multiple brands, organize campaigns, share password-protected analytics with clients, and move projects between brands in seconds.",
              visual: "agency",
            },
            {
              tag: "Mobile",
              title: "Mobile app deep linking",
              body: "Open YouTube, Instagram, TikTok, Spotify, and more directly inside native apps — better UX, higher conversion.",
              visual: "mobile",
              reverse: true,
            },
          ].map((f) => (
            <div
              key={f.title}
              className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                f.reverse ? "lg:[direction:rtl]" : ""
              }`}
            >
              <div className={f.reverse ? "lg:[direction:ltr]" : ""}>
                <SectionLabel>{f.tag}</SectionLabel>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-4 text-slate-600 leading-relaxed text-lg">
                  {f.body}
                </p>
                {f.example && (
                  <p className="mt-4 font-mono text-sm text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-lg px-4 py-3 inline-block">
                    {f.example}
                  </p>
                )}
              </div>
              <div
                className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-xl min-h-[240px] flex items-center justify-center ${
                  f.reverse ? "lg:[direction:ltr]" : ""
                }`}
              >
                <FeatureVisual type={f.visual} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="py-20 sm:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <SectionLabel>Compare</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Linkto vs traditional solutions
            </h2>
            <p className="mt-3 text-slate-600">
              Why marketing teams outgrow Bitly and spreadsheets.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
            <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200 text-sm font-semibold">
              <div className="p-4 text-slate-600" />
              <div className="p-4 text-center text-cyan-700 bg-cyan-50/80">
                Linkto
              </div>
              <div className="p-4 text-center text-slate-500">Bitly</div>
              <div className="p-4 text-center text-slate-500">UTM sheets</div>
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={row}
                className={`grid grid-cols-4 text-sm border-b border-slate-100 last:border-0 ${
                  i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                }`}
              >
                <div className="p-4 font-medium text-slate-800 capitalize">
                  {row}
                </div>
                <div className="p-4 flex justify-center bg-cyan-50/30">
                  <Check className="h-5 w-5 text-cyan-600" />
                </div>
                <div className="p-4 flex justify-center">
                  <Minus className="h-5 w-5 text-slate-300" />
                </div>
                <div className="p-4 flex justify-center">
                  <X className="h-5 w-5 text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="py-20 sm:py-28 bg-[#0a0a0f] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <SectionLabel>Use cases</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built for how teams actually run creator campaigns
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Users,
                title: "Creator campaigns",
                body: "Track every creator in one campaign view.",
              },
              {
                icon: Mic,
                title: "Podcasts",
                body: "Know which clips and hosts drive traffic.",
              },
              {
                icon: Building2,
                title: "Agencies",
                body: "All client campaigns in one workspace.",
              },
              {
                icon: Sparkles,
                title: "Brands",
                body: "Measure influencer performance accurately.",
              },
            ].map((u) => (
              <div
                key={u.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/[0.07] transition-colors"
              >
                <u.icon className="h-6 w-6 text-cyan-400 mb-4" />
                <h3 className="font-bold text-lg">{u.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  {u.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-28 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <SectionLabel>Testimonials</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Teams ship faster with clearer data
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col"
              >
                <p className="text-slate-700 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="mt-6 pt-6 border-t border-slate-100">
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-500">
                    {t.role}, {t.company}
                  </p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 sm:py-32 relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900 text-white">
        <div
          className="absolute inset-0 landing-grid opacity-20"
          aria-hidden
        />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Stop wondering which creators perform best.
          </h2>
          <p className="mt-6 text-lg text-slate-400 space-y-1">
            <span className="block">Track every click.</span>
            <span className="block">Measure every creator.</span>
            <span className="block">Scale what works.</span>
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryCta large />
            <a
              href="mailto:hello@linkto.in"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureVisual({ type }: { type: string }) {
  if (type === "creators") {
    return (
      <ul className="w-full space-y-3 text-left">
        {["john_doe", "fitnessguru", "podcast_host"].map((c) => (
          <li
            key={c}
            className="flex items-center gap-3 rounded-lg border border-slate-100 px-4 py-3"
          >
            <span className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-xs font-bold flex items-center justify-center">
              {c[0].toUpperCase()}
            </span>
            <span className="font-mono text-sm text-slate-700">/{c}</span>
            <span className="ml-auto text-xs text-emerald-700 font-medium">
              attributed
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (type === "analytics") {
    return (
      <div className="w-full grid grid-cols-2 gap-3 text-sm">
        {["Top creators", "Top locations", "Top devices", "Top platforms"].map(
          (l) => (
            <div
              key={l}
              className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-4 font-medium text-slate-700"
            >
              {l}
            </div>
          )
        )}
      </div>
    );
  }
  if (type === "agency") {
    return (
      <div className="w-full space-y-3 text-left text-sm">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Building2 className="h-4 w-4" /> 3 brands · 12 campaigns
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Share2 className="h-4 w-4" /> Client share links
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Lock className="h-4 w-4" /> Password-protected views
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 text-slate-600">
      <Smartphone className="h-12 w-12 text-cyan-500" />
      <p className="text-sm font-medium text-center max-w-[200px]">
        Native app opens on mobile
      </p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-[#07070b] text-slate-400 border-t border-white/5 py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="Linkto"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span className="font-semibold text-white">Linkto</span>
            </div>
            <p className="text-sm leading-relaxed">
              Branded links. Creator-level clarity.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Product
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#compare" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Company
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@linkto.in"
                  className="hover:text-white transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Legal
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-12 pt-8 border-t border-white/5 text-xs text-center text-slate-400">
          © {new Date().getFullYear()} Linkto. Creator analytics, not just link
          shortening.
        </p>
      </div>
    </footer>
  );
}
