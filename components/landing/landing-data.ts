/** Facts about the product itself (see docs/conversion-tracking.md). */
export const FACTS = [
  { value: "1", label: "Snippet for the brand to paste" },
  { value: "10 min", label: "Typical setup, copy and paste" },
  { value: "< 3 KB", label: "Script size on the brand's site" },
  { value: "30 days", label: "Click-to-purchase attribution window" },
] as const;

export const LANDING_FAQ = [
  {
    q: "Does the brand need its own referral or affiliate system?",
    a: "No. Linkto tags every click and the brand pastes one snippet on its website. There are no referral codes, coupons or creator accounts to manage on the brand's side.",
  },
  {
    q: "What exactly can I track?",
    a: "Clicks, visits to the brand's site, signups, purchases and revenue, each credited to the creator whose link was clicked. You can also record custom events such as add-to-cart.",
  },
  {
    q: "Which websites and apps does it work with?",
    a: "Any website where code can be added, Shopify, WordPress with WooCommerce, Google Tag Manager, and mobile apps or backends through a server API.",
  },
  {
    q: "Can the numbers be faked?",
    a: "Events sent from a browser can be faked by a visitor, as with any tracking script. For payouts, the brand reports purchases from its own server with a secret key, and you switch on verified purchases so only those are counted.",
  },
  {
    q: "What does the script collect?",
    a: "A click ID, the event name and, for purchases, the amount, currency and order number. No names, emails, phone numbers or card details.",
  },
  {
    q: "Can I share results with a client?",
    a: "Yes. Every campaign has a live report link, optionally password-protected, showing clicks through to revenue per creator. Reports also export to PDF and Excel.",
  },
] as const;

export const COMPARISON_ROWS = [
  "Creator attribution",
  "Signup and purchase tracking",
  "Revenue per creator",
  "Verified (server-side) purchases",
  "Branded campaign URLs",
  "Campaign organization",
  "Client-ready reporting",
  "Password-protected analytics",
  "Multi-brand management",
] as const;

export const URL_SEGMENTS = [
  { key: "brand", label: "Brand", value: "acme", hint: "Your client or house brand" },
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
