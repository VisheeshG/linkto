# Linkto design system

How Linkto's UI is put together, so new screens look and behave like existing
ones. Building blocks live in `components/ui` (import from `@/components/ui`);
tokens live at the top of `app/globals.css`.

## Principles

1. **Answer first.** Every page opens with the numbers people come for (KPIs),
   then detail. Setup and configuration sit behind a tab or a dialog.
2. **One primary action per view.** One filled button in a page header; the
   rest are secondary, ghost or inside a "…" menu.
3. **Genuine clicks by default.** Wherever a click count is shown, say whether
   bots are hidden ("Genuine clicks", "of 1,872 incl. bots").
4. **Works at 360px.** No horizontal page scroll at any width; tables become
   lists on phones and dialogs become bottom sheets.
5. **Accessible by construction.** The primitives handle labels, focus and
   keyboard use, so using them is enough for WCAG 2.1 AA.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `primary-50…900` | Indigo (`#4f46e5` at 600) | Actions, links, selection, focus ring |
| Success / warning / danger / info | Tailwind emerald / amber / rose / sky | Status only, through `Badge` tones and states |
| Violet | Tailwind violet | Brand identity (brand icons and cards) |
| Background | `slate-50` (`#f8fafc`) | App canvas |
| Surface | white + `border-slate-200` + `shadow-sm`, `rounded-xl` | Every card |
| Text | `slate-900` headings, `slate-600` secondary | Never lighter than `slate-600` on white (4.5:1) |
| Font | System UI stack (`--font-sans`), `--font-mono` for URLs and codes | |

**Type scale.** Page title `text-2xl sm:text-3xl font-bold`; section title
`text-lg font-semibold`; card title `text-base font-semibold`; body `text-sm`;
meta `text-xs text-slate-600`. Numbers use `tabular-nums`.

**Spacing.** Page gutters `px-4 lg:px-8`, max width `max-w-7xl` (app) or
`max-w-5xl` (shared report). Cards `p-4 sm:p-5`. Gap between cards `gap-3 sm:gap-4`.

**Focus and motion.** `:focus-visible` draws a 2px primary outline on every
interactive element. `prefers-reduced-motion` disables animations. Print styles
hide `.print-hidden` and keep `.print-avoid-break` blocks together.

## Components (`components/ui`)

| Component | Notes |
| --- | --- |
| `Button` | Variants `primary` · `secondary` · `ghost` · `subtle` · `danger`; sizes `sm` (32px) · `md` (40px) · `lg` (44px). `loading` shows a spinner and disables. Icon-only buttons **must** pass `label`, which becomes `aria-label` and the tooltip. `buttonClasses()` styles a `<Link>` the same way. |
| `Card`, `CardHeader` | Standard surface. `CardHeader` takes `title`, `description`, `icon`, `actions`. |
| `PageHeader` | Page title, `description`, `meta`, `icon` and right-aligned `actions` (stack under the title on phones). |
| `Badge` | Tones `neutral` · `primary` · `success` · `warning` · `danger` · `info` · `violet`. Platforms are neutral; "Expired" danger; "Expires …" warning; UTM info. |
| `Field` + `Input` / `Select` / `Textarea` | `Field` renders the label, hint and error and wires `id`/`aria-describedby` into its single child. Pass `fullWidth` instead of `w-full` (`cn` doesn't resolve conflicting classes). `CheckboxField` for checkboxes with a description. |
| `Dialog` | Native `<dialog>` + `showModal()`: focus trap, Escape and focus return are built in. Centered on ≥640px, bottom sheet on phones. `footer` for actions (primary rightmost on desktop, on top on phones); `dismissible={false}` while saving. |
| `ConfirmDialog` | For every destructive action. Name the thing being deleted and its consequences in `description`. |
| `DropdownMenu` | "…" and split-button menus. Arrow keys, Home/End, Escape, click-outside. Items take `icon`, `description`, `tone: "danger"`. |
| `Tabs` / `TabPanel` | ARIA tablist with arrow-key navigation and optional counts. Use a unique `idPrefix` per page. |
| `Skeleton`, `LoadingBlock` | Loading placeholders shaped like the content; `LoadingBlock` announces to screen readers. |
| `EmptyState` | Icon, title, one sentence, and the next action as a button. |
| `ErrorState` | Inline load error with Retry; use instead of a toast for anything that leaves a page empty. |
| `CopyButton` | Shows "Copied" in place for 2s; no toast. |
| `Switch` | Labelled on/off toggle (e.g. "Hide bots"). |

### App-level building blocks

- `components/app/AppHeader` — sticky bar on signed-in pages: logo (→ dashboard),
  breadcrumbs (collapse to "‹ Parent" on phones) and the account menu.
- `components/app/AppPage` — page frame with `AppHeader`; also exports
  `PageSkeleton` and `PageNotFound`.
- `components/public/PublicShell` — shared-report frame (no account controls,
  optional Print / Save PDF, "Powered by" footer).
- `components/analytics/*` — `AnalyticsToolbar` (date range, filters dialog with
  removable chips, Hide bots), `BreakdownCard`, `TrafficQualityCard`,
  `CreatorTable`, `CreatorDetailDialog`, `LinkSetupPanel`.
- `components/StatCard` — KPI tile with optional `sublabel`.

## Patterns

**Clickable cards.** Make the title a real `<button>` (or link) stretched over the
card with `after:absolute after:inset-0`. Put secondary controls in a
`relative z-20` container so they sit above it. This keeps one tab stop per card
and a proper accessible name.

**Numbers.** `formatNumber` (en-IN grouping) for exact counts, `formatCompact`
(K / L / Cr) where space is tight, `formatRelative` for "Edited 2d ago",
`formatPercent` for shares (all in `lib/format.ts`).

**Feedback.** Toasts only for confirmations of completed background actions
("Link created"). Validation errors appear inline under the field; load errors
use `ErrorState`.

**Responsive.** Check every change at 375, 768 and 1440px. Tables need a list
layout below `sm`, and wide scroll regions need `tabIndex={0}`, `role="region"`
and an `aria-label`.

## Checking a change

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Then load the changed pages at 375 / 768 / 1440px and run axe
(`@axe-core/playwright`, a dev dependency) with the `wcag2a`, `wcag2aa`,
`wcag21a` and `wcag21aa` tags. The redesign shipped with zero violations and no
horizontal overflow on all 30 screens × 3 widths.
