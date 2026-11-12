export const STATS = [
  { value: "18,400+", label: "Campaigns tracked" },
  { value: "52M+", label: "Clicks processed" },
  { value: "940K+", label: "Creators analyzed" },
  { value: "2,800+", label: "Brands onboarded" },
] as const;

export const LOGO_NAMES = [
  "Velocity Media",
  "Northstar Agency",
  "Creator Labs",
  "Pulse Brands",
  "Summit Growth",
  "Atlas Partners",
] as const;

export const COMPARISON_ROWS = [
  "Creator attribution",
  "Signup and purchase tracking",
  "Revenue per creator",
  "Branded campaign URLs",
  "Campaign organization",
  "Client-ready reporting",
  "Password-protected analytics",
  "Multi-brand management",
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "We cut weekly reporting from six hours to forty minutes. Every stakeholder finally sees which creator actually moved the needle — not just total clicks.",
    name: "Sarah Chen",
    role: "Head of Influencer Marketing",
    company: "DTC Beauty Brand",
  },
  {
    quote:
      "Linkto replaced our UTM spreadsheet nightmare. Branded URLs look client-ready, and attribution is built into the path — no more guessing which link belongs to whom.",
    name: "Marcus Webb",
    role: "Founder",
    company: "Creator-First Agency",
  },
  {
    quote:
      "Podcast clip campaigns used to be a black box. Now we know which host segments drive traffic and can double down on winners the same week.",
    name: "Priya Nair",
    role: "Growth Lead",
    company: "Media Network",
  },
] as const;

export const URL_SEGMENTS = [
  { key: "brand", label: "Brand", value: "nike", hint: "Your client or house brand" },
  {
    key: "campaign",
    label: "Campaign",
    value: "summer-launch",
    hint: "Project or launch slug",
  },
  {
    key: "code",
    label: "Tracking code",
    value: "abc123",
    hint: "Unique short code per link",
  },
  {
    key: "creator",
    label: "Creator",
    value: "john_doe",
    hint: "Creator handle in every click",
  },
] as const;

export const CREATOR_ROWS = [
  { handle: "john_doe", clicks: 2438, pct: 42 },
  { handle: "fitnessguru", clicks: 1842, pct: 32 },
  { handle: "startupguy", clicks: 1201, pct: 21 },
] as const;
