# Linkto UI/UX audit

Baseline captured before the redesign: 15 screens × 3 widths (375 / 768 / 1440px)
against a local mock backend, plus an axe-core WCAG 2.1 AA scan at 375 and 1440px.
Horizontal overflow was already fixed by the responsive pass (VisheeshG/linkto#12).

Each item is marked ✅ when addressed by the redesign.

**Result after the redesign:** the same sweep (30 screens × 3 widths, 90
screenshots) shows **0 axe violations, 0 horizontal overflow and 0 console
errors** at every width.

## Automated accessibility findings (axe-core, WCAG 2.1 AA)

| Screen | Critical | Serious |
| --- | --- | --- |
| Landing | — | color-contrast ×21 |
| Dashboard | button-name ×1 (icon-only delete) | color-contrast ×1 |
| Brand page | button-name ×2 | color-contrast ×7 |
| Brand analytics | button-name ×2 | color-contrast ×7 |
| Project title edit | label ×2 (inputs without labels) | — |
| New project dialog | button-name ×1 | color-contrast ×2 |
| Link analytics / map | — | color-contrast ×1 |

- [x] ✅ Icon-only buttons (delete, edit, copy, close) have no accessible name.
- [x] ✅ Inline edit inputs have no associated `<label>`.
- [x] ✅ Grey helper text (`text-slate-400` / `text-slate-500` on white or tinted
      backgrounds) fails 4.5:1 contrast; the landing page uses low-alpha white text.

## Visual consistency
- [x] ✅ Five different card styles: `rounded-xl` / `rounded-2xl`, `shadow-sm` /
      `shadow-lg` / `shadow-2xl`, borders at different opacities.
- [x] ✅ Decorative `hover:scale-[1.02]` on non-interactive cards.
- [x] ✅ Gradient buttons in two primary colors with no meaning: violet ("New Brand",
      "Passwords") vs blue ("New Project", "Share Project", "New Link").
- [x] ✅ Section titles range from `text-base` to `text-4xl` with no scale.
- [x] ✅ Badges: platform, expiry, UTM, traffic types each styled ad hoc.
- [x] ✅ Font stack refers to an undefined `--font-geist-sans`.

## Navigation and layout
- [x] ✅ Every page has its own header: logo + email + sign out (dashboard),
      "Back to dashboard" text (brand), breadcrumbs (project), bare arrow (link
      analytics). There is no persistent way to reach the dashboard or sign out
      from inner pages.
- [x] ✅ Inner pages lose the Linkto identity entirely (no logo).
- [x] ✅ Two competing primary buttons on the dashboard ("New Brand", "New Project").
- [x] ✅ Project page: "Passwords" and "Share Project" are two loud buttons for one
      concern (who can see this project).

## Link analytics (most-used page)
- [x] ✅ One very long scroll: header, bot bar, 4 KPIs, tracking URL, QR, filters,
      date range, chart, 10 breakdown cards, creator table.
- [x] ✅ The answer people come for (top creators, genuine vs total) is far down.
- [x] ✅ Filters and date range live in two separate cards; active filters are only
      visible inside the dropdowns.
- [x] ✅ "Clicks by Link Title" always shows one row (this page is one link).
- [x] ✅ Setup content (tracking URL format, QR) sits above the analytics.

## Project page
- [x] ✅ Links can only be searched, not sorted (by clicks / newest / name).
- [ ] Link cards don't show when a link last received a click. *(Open: needs a
      last-click timestamp from the API; out of scope for a UI-only change.)*

## Dashboard and brand page
- [x] ✅ No first-run guidance beyond a short "Get started" box.
- [x] ✅ Brand page stacks projects and combined analytics in one long page.

## Shared client page
- [x] ✅ Looks like the internal dashboard; reads as an app screen, not a report.
- [ ] Internal jargon visible to clients ("sub1", slugs, "Submission").
      *(Partly: the report page leads with plain-language KPIs and copy, but
      tracking URLs and the Submissions breakdown still use these terms.)*
- [x] ✅ Not print-friendly.

## States and feedback
- [x] ✅ Loading shown as plain "Loading..." text, spinners, or pulses depending on page.
- [x] ✅ Load errors appear only as toasts; the page then looks empty.
- [x] ✅ Empty states vary (dashed box, plain text) and rarely offer the next action.
- [x] ✅ Delete confirmations are hand-rolled modals without focus trapping, Escape
      handling or focus return.
- [x] ✅ Copy actions confirm via a floating toast far from the button.

## Forms and dialogs
- [x] ✅ Each dialog is hand-built with different spacing, headers and buttons.
- [x] ✅ New-link form shows every option at once (submission, open-in-app, UTM,
      expiry) instead of progressive disclosure.
- [x] ✅ Validation messages appear as toasts rather than inline next to fields.

## Copy
- [x] ✅ Mixed casing ("Sign Out" / "Sign out", "Create Link" / "New link").
- [x] ✅ Inconsistent numbers: some `toLocaleString()`, some raw.
