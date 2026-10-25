# Linkto UI/UX audit

Baseline captured before the redesign: 15 screens × 3 widths (375 / 768 / 1440px)
against a local mock backend, plus an axe-core WCAG 2.1 AA scan at 375 and 1440px.
Horizontal overflow was already fixed by the responsive pass (VisheeshG/linkto#12).

Each item is marked ✅ when addressed by the redesign.

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

- [ ] Icon-only buttons (delete, edit, copy, close) have no accessible name.
- [ ] Inline edit inputs have no associated `<label>`.
- [ ] Grey helper text (`text-slate-400` / `text-slate-500` on white or tinted
      backgrounds) fails 4.5:1 contrast; the landing page uses low-alpha white text.

## Visual consistency
- [ ] Five different card styles: `rounded-xl` / `rounded-2xl`, `shadow-sm` /
      `shadow-lg` / `shadow-2xl`, borders at different opacities.
- [ ] Decorative `hover:scale-[1.02]` on non-interactive cards.
- [ ] Gradient buttons in two primary colors with no meaning: violet ("New Brand",
      "Passwords") vs blue ("New Project", "Share Project", "New Link").
- [ ] Section titles range from `text-base` to `text-4xl` with no scale.
- [ ] Badges: platform, expiry, UTM, traffic types each styled ad hoc.
- [ ] Font stack refers to an undefined `--font-geist-sans`.

## Navigation and layout
- [ ] Every page has its own header: logo + email + sign out (dashboard),
      "Back to dashboard" text (brand), breadcrumbs (project), bare arrow (link
      analytics). There is no persistent way to reach the dashboard or sign out
      from inner pages.
- [ ] Inner pages lose the Linkto identity entirely (no logo).
- [ ] Two competing primary buttons on the dashboard ("New Brand", "New Project").
- [ ] Project page: "Passwords" and "Share Project" are two loud buttons for one
      concern (who can see this project).

## Link analytics (most-used page)
- [ ] One very long scroll: header, bot bar, 4 KPIs, tracking URL, QR, filters,
      date range, chart, 10 breakdown cards, creator table.
- [ ] The answer people come for (top creators, genuine vs total) is far down.
- [ ] Filters and date range live in two separate cards; active filters are only
      visible inside the dropdowns.
- [ ] "Clicks by Link Title" always shows one row (this page is one link).
- [ ] Setup content (tracking URL format, QR) sits above the analytics.

## Project page
- [ ] Links can only be searched, not sorted (by clicks / newest / name).
- [ ] Link cards don't show when a link last received a click.

## Dashboard and brand page
- [ ] No first-run guidance beyond a short "Get started" box.
- [ ] Brand page stacks projects and combined analytics in one long page.

## Shared client page
- [ ] Looks like the internal dashboard; reads as an app screen, not a report.
- [ ] Internal jargon visible to clients ("sub1", slugs, "Submission").
- [ ] Not print-friendly.

## States and feedback
- [ ] Loading shown as plain "Loading..." text, spinners, or pulses depending on page.
- [ ] Load errors appear only as toasts; the page then looks empty.
- [ ] Empty states vary (dashed box, plain text) and rarely offer the next action.
- [ ] Delete confirmations are hand-rolled modals without focus trapping, Escape
      handling or focus return.
- [ ] Copy actions confirm via a floating toast far from the button.

## Forms and dialogs
- [ ] Each dialog is hand-built with different spacing, headers and buttons.
- [ ] New-link form shows every option at once (submission, open-in-app, UTM,
      expiry) instead of progressive disclosure.
- [ ] Validation messages appear as toasts rather than inline next to fields.

## Copy
- [ ] Mixed casing ("Sign Out" / "Sign out", "Create Link" / "New link").
- [ ] Inconsistent numbers: some `toLocaleString()`, some raw.
