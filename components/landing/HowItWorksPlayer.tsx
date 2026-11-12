"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Eye,
  Heart,
  MessageCircle,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShoppingBag,
  UserPlus,
} from "lucide-react";

/** How long each scene stays on screen. */
export const SCENE_MS = 5000;

const SCENES = [
  {
    title: "A creator shares their link",
    body: "Every creator gets their own Linkto link for your campaign. They post it like any other link.",
  },
  {
    title: "A follower clicks. Linkto tags the click",
    body: "Linkto records who sent them, then adds a small invisible tag to the page it opens.",
  },
  {
    title: "They land on your website",
    body: "One pasted snippet on your site remembers the tag. The visit is counted.",
  },
  {
    title: "They sign up",
    body: "Your site tells Linkto a signup happened. Linkto knows which creator to credit.",
  },
  {
    title: "They buy",
    body: "The order amount is recorded against the same creator. Each order counts once.",
  },
  {
    title: "You see results per creator",
    body: "Clicks, visits, signups, sales and revenue, without building a referral system.",
  },
] as const;

const FUNNEL = [
  { label: "Click", icon: MousePointerClick, from: 1 },
  { label: "Visit", icon: Eye, from: 2 },
  { label: "Signup", icon: UserPlus, from: 3 },
  { label: "Purchase", icon: ShoppingBag, from: 4 },
] as const;

function Recorded({ children }: { children: React.ReactNode }) {
  return (
    <p className="hiw-pop inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
      <Check className="h-3.5 w-3.5" aria-hidden />
      {children}
    </p>
  );
}

function Browser({ url, children }: { url: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-white text-slate-900 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          <i className="h-2 w-2 rounded-full bg-slate-300" />
          <i className="h-2 w-2 rounded-full bg-slate-300" />
          <i className="h-2 w-2 rounded-full bg-slate-300" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200">
          {url}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Scene({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-4 text-slate-900 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-sm font-bold text-white">
              A
            </span>
            <div>
              <p className="text-sm font-semibold">asha.cooks</p>
              <p className="text-xs text-slate-600">Sponsored by Acme</p>
            </div>
          </div>
          <div className="mt-3 h-24 rounded-lg bg-gradient-to-br from-amber-100 via-rose-100 to-violet-100" aria-hidden />
          <p className="mt-3 text-sm">My festive picks are live. Link below 👇</p>
          <p className="hiw-pop mt-2 truncate rounded-lg bg-cyan-50 px-2.5 py-2 font-mono text-xs font-semibold text-cyan-800 ring-1 ring-cyan-200">
            linkto.in/acme/diwali/abc123/<span className="text-blue-700">asha</span>
          </p>
          <div className="mt-3 flex gap-4 text-slate-500" aria-hidden>
            <Heart className="h-4 w-4" />
            <MessageCircle className="h-4 w-4" />
            <Send className="h-4 w-4" />
          </div>
        </div>
      );
    case 1:
      return (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <p className="w-full truncate rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center font-mono text-sm text-slate-300">
            linkto.in/acme/diwali/abc123/asha
          </p>
          <div className="hiw-pop flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <MousePointerClick className="h-4 w-4" aria-hidden />
            Click recorded for asha
          </div>
          <span className="h-6 w-px bg-white/20" aria-hidden />
          <p className="hiw-pop-late w-full truncate rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-3 text-center font-mono text-sm text-white">
            acme.com/sale
            <span className="rounded bg-cyan-400/25 px-1 text-cyan-200">?lt_id=k3J9xQ2m</span>
          </p>
          <p className="hiw-pop-late text-center text-xs text-slate-400">
            The tag is unique to this one click.
          </p>
        </div>
      );
    case 2:
      return (
        <div className="flex w-full flex-col items-center gap-4">
          <Browser url="acme.com/sale">
            <p className="text-sm font-bold">Acme · Diwali sale</p>
            <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-slate-100" />
              ))}
            </div>
          </Browser>
          <Recorded>Visit recorded · credited to asha</Recorded>
        </div>
      );
    case 3:
      return (
        <div className="flex w-full flex-col items-center gap-4">
          <Browser url="acme.com/welcome">
            <p className="text-sm font-bold">Create your account</p>
            <div className="mt-3 space-y-2" aria-hidden>
              <div className="h-8 rounded-md bg-slate-100" />
              <div className="h-8 rounded-md bg-slate-100" />
            </div>
            <p className="mt-3 rounded-md bg-slate-900 py-2 text-center text-xs font-semibold text-white">
              Welcome aboard!
            </p>
          </Browser>
          <Recorded>Signup recorded · credited to asha</Recorded>
        </div>
      );
    case 4:
      return (
        <div className="flex w-full flex-col items-center gap-4">
          <Browser url="acme.com/order-confirmed">
            <p className="text-sm font-bold">Order confirmed</p>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2.5 text-sm">
              <span className="text-slate-600">Order #1001</span>
              <span className="font-bold tabular-nums">₹1,499</span>
            </div>
          </Browser>
          <Recorded>Purchase recorded · ₹1,499 credited to asha</Recorded>
        </div>
      );
    default:
      return (
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-white text-slate-900 shadow-2xl">
          <p className="border-b border-slate-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Diwali sale · results by creator
          </p>
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                {["Creator", "Clicks", "Signups", "Sales", "Revenue"].map((h, i) => (
                  <th key={h} scope="col" className={`px-3 py-2 font-semibold ${i ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[
                ["asha", "2,410", "318", "96", "₹1,43,904"],
                ["vish", "1,872", "204", "51", "₹76,449"],
                ["rohan", "1,105", "87", "19", "₹28,481"],
              ].map((row, r) => (
                <tr
                  key={row[0]}
                  className="hiw-row border-t border-slate-100"
                  style={{ animationDelay: `${0.25 + r * 0.35}s` }}
                >
                  {row.map((cell, i) => (
                    <td key={i} className={`px-3 py-2 ${i ? "text-right" : "font-semibold"} ${i === 4 ? "font-bold" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-600">Example numbers</p>
        </div>
      );
  }
}

/**
 * Animated explainer: six short scenes that follow one click from a
 * creator's post to a purchase and into the report. Plays while on screen;
 * can be paused, replayed and stepped through.
 */
export function HowItWorksPlayer({ autoPlay = true }: { autoPlay?: boolean }) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const userPaused = useRef(false);

  // Start when scrolled into view, stop when scrolled away. Visitors who
  // prefer reduced motion get the first scene and the controls only.
  useEffect(() => {
    if (!autoPlay) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!userPaused.current) setPlaying(true);
        } else {
          setPlaying(false);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoPlay]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (scene === SCENES.length - 1) {
        setPlaying(false);
        setFinished(true);
        userPaused.current = true;
      } else {
        setScene(scene + 1);
      }
    }, SCENE_MS);
    return () => clearTimeout(timer);
  }, [playing, scene]);

  const toggle = () => {
    if (finished) {
      setFinished(false);
      setScene(0);
      userPaused.current = false;
      setPlaying(true);
      return;
    }
    userPaused.current = playing;
    setPlaying(!playing);
  };

  const jump = (index: number) => {
    setFinished(false);
    setScene(index);
  };

  const current = SCENES[scene];
  const ControlIcon = finished ? RotateCcw : playing ? Pause : Play;
  const controlLabel = finished ? "Replay" : playing ? "Pause" : "Play";

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label="How Linkto tracks a click through to a purchase"
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] text-white shadow-2xl"
    >
      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-10">
        <div key={`text-${scene}`} className="hiw-in">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Step {scene + 1} of {SCENES.length}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{current.title}</h3>
          <p className="mt-3 text-base leading-relaxed text-slate-300">{current.body}</p>
        </div>
        <div
          key={`stage-${scene}`}
          className="hiw-in landing-grid flex min-h-[300px] items-center justify-center rounded-xl bg-white/[0.03] p-4 sm:min-h-[380px] sm:p-6"
        >
          <Scene index={scene} />
        </div>
      </div>

      <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 border-t border-white/10 px-4 py-4">
        {FUNNEL.map((step, i) => {
          const done = scene >= step.from;
          return (
            <li key={step.label} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors duration-500 ${
                  done
                    ? "bg-cyan-400/15 text-cyan-200 ring-cyan-400/40"
                    : "bg-white/5 text-slate-400 ring-white/10"
                }`}
              >
                <step.icon className="h-3.5 w-3.5" aria-hidden />
                {step.label}
                {done && <span className="sr-only"> (tracked)</span>}
              </span>
              {i < FUNNEL.length - 1 && <span className="text-slate-600" aria-hidden>→</span>}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-3 border-t border-white/10 bg-white/[0.03] px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={controlLabel}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 hover:bg-slate-200"
        >
          <ControlIcon className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex flex-1 items-center gap-1.5">
          {SCENES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => jump(i)}
              aria-label={`Step ${i + 1}: ${s.title}`}
              aria-current={i === scene ? "step" : undefined}
              className="group flex h-10 flex-1 items-center"
            >
              <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15 group-hover:bg-white/25">
                <span
                  key={`${i}-${scene}-${playing}`}
                  className={`absolute inset-y-0 left-0 rounded-full bg-cyan-400 ${
                    i < scene || (i === scene && finished)
                      ? "w-full"
                      : i === scene
                        ? playing
                          ? "hiw-progress"
                          : "w-1/12"
                        : "w-0"
                  }`}
                  style={i === scene && playing ? { animationDuration: `${SCENE_MS}ms` } : undefined}
                />
              </span>
            </button>
          ))}
        </div>
        <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:inline">
          {scene + 1} / {SCENES.length}
        </span>
      </div>
    </div>
  );
}
