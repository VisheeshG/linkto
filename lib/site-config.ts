/** Central brand + SEO config (single source of truth). */
export const siteConfig = {
  name: "Linkto",
  tagline: "Creator links tracked from click to purchase.",
  description:
    "Linkto tracks creator links from the click through to the visit, signup and purchase. Give each creator a branded link and see the signups, sales and revenue they drive, without building a referral system.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://linkto.in",
  keywords: [
    "link tracking",
    "creator analytics",
    "influencer marketing",
    "branded links",
    "campaign analytics",
    "UTM alternative",
    "creator attribution",
    "conversion tracking",
    "influencer sales tracking",
    "agency reporting",
    "linkto",
  ],
} as const;

export const defaultTitle = `${siteConfig.name} — ${siteConfig.tagline}`;
