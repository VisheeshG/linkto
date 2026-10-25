// Classifies a click as human or non-human traffic.
//
// Categories (strongest signal wins):
// - "bot":        the client declares itself as a crawler / link-preview fetcher /
//                 HTTP library, or makes a HEAD request.
// - "datacenter": the request comes from a cloud / hosting network (Google,
//                 AWS, Microsoft, Meta, DigitalOcean, ...) rather than a home or
//                 mobile ISP. Real people almost never browse from these.
// - "suspicious": browser-like UA but missing headers every real browser
//                 sends, or a burst of repeated clicks from the same visitor.
// - "human":      none of the above.

export type TrafficType = "human" | "bot" | "datacenter" | "suspicious";

export const TRAFFIC_TYPES: TrafficType[] = [
  "human",
  "bot",
  "datacenter",
  "suspicious",
];

export type NetworkInfo = {
  asn: string | null;
  isp: string | null;
  org: string | null;
  isHosting: boolean | null;
};

export type ClickSignals = {
  userAgent: string;
  method?: string;
  acceptLanguage?: string | null;
  network?: NetworkInfo | null;
  /** Clicks on the same link from the same visitor within the burst window. */
  recentClicksFromVisitor?: number;
};

export type ClickClassification = {
  trafficType: TrafficType;
  reason: string | null;
};

/** How many prior clicks within BURST_WINDOW_SECONDS mark a click as suspicious. */
export const BURST_THRESHOLD = 5;
export const BURST_WINDOW_SECONDS = 60;

// [pattern, label]. Checked against the lower-cased user agent.
const BOT_USER_AGENTS: [RegExp, string][] = [
  // Link-preview fetchers: these hit a link whenever it is pasted into a chat.
  [/facebookexternalhit|facebookcatalog|meta-externalagent|meta-externalfetcher/, "Meta link preview"],
  [/whatsapp/, "WhatsApp link preview"],
  [/twitterbot/, "X/Twitter link preview"],
  [/linkedinbot/, "LinkedIn link preview"],
  [/slackbot|slack-imgproxy/, "Slack link preview"],
  [/telegrambot/, "Telegram link preview"],
  [/discordbot/, "Discord link preview"],
  [/skypeuripreview/, "Skype link preview"],
  [/pinterestbot/, "Pinterest crawler"],
  [/redditbot/, "Reddit link preview"],
  [/snapchat.*(bot|preview)|snap url preview/, "Snapchat link preview"],
  [/vkshare|kakaotalk-scrap/, "Messenger link preview"],
  [/iframely|embedly|outbrain|quora link preview|bitlybot|google-pagerenderer/, "Embed / preview service"],
  // Search engines and SEO crawlers.
  [/googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|google-read-aloud|storebot-google/, "Google crawler"],
  [/bingbot|bingpreview|msnbot|adidxbot/, "Bing crawler"],
  [/applebot/, "Apple crawler"],
  [/yandex|baiduspider|duckduckbot|duckassistbot|sogou|exabot|seznambot|petalbot|yeti\//, "Search crawler"],
  [/ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|screaming frog|dataforseobot|blexbot|serpstatbot/, "SEO crawler"],
  // AI crawlers.
  [/gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|bytespider|amazonbot|cohere-ai|diffbot|youbot/, "AI crawler"],
  // Security scanners / uptime monitors.
  [/uptimerobot|pingdom|statuscake|site24x7|newrelicpinger|datadog|censysinspect|zgrab|masscan|nmap|nessus|qualys|expanse|paloalto|virustotal|urlscan|safebrowsing|phishtank|netcraft/, "Scanner / monitor"],
  // Headless browsers and HTTP libraries.
  [/headlesschrome|phantomjs|puppeteer|playwright|selenium|electron\//, "Headless browser"],
  [/^curl\/|^wget\/|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java\/|apache-httpclient|libwww-perl|node-fetch|axios\/|undici|got \(|postmanruntime|insomnia|ruby|php\/|scrapy|httpclient/, "HTTP library"],
  // Generic markers, last so the specific labels above win.
  [/\bbot\b|bot\/|crawler|spider|scraper|preview|fetcher|monitor|checker/, "Generic bot"],
];

// Autonomous systems that belong to cloud / hosting providers. Used in
// addition to the geolocation provider's own "hosting" flag. Consumer VPN /
// relay networks (Cloudflare WARP, iCloud Private Relay) are deliberately not
// listed since real people browse through them.
export const DATACENTER_ASNS: Record<string, string> = {
  AS15169: "Google",
  AS396982: "Google Cloud",
  AS19527: "Google",
  AS36040: "Google (YouTube)",
  AS16509: "Amazon AWS",
  AS14618: "Amazon AWS",
  AS8987: "Amazon AWS",
  AS8075: "Microsoft Azure",
  AS8068: "Microsoft",
  AS32934: "Meta (Facebook)",
  AS63293: "Meta (Facebook)",
  AS54115: "Meta (Facebook)",
  AS13414: "X/Twitter",
  AS14413: "LinkedIn",
  AS14061: "DigitalOcean",
  AS16276: "OVH",
  AS24940: "Hetzner",
  AS213230: "Hetzner",
  AS63949: "Akamai Linode",
  AS20473: "Vultr",
  AS31898: "Oracle Cloud",
  AS45102: "Alibaba Cloud",
  AS37963: "Alibaba Cloud",
  AS132203: "Tencent Cloud",
  AS45090: "Tencent Cloud",
  AS136907: "Huawei Cloud",
  AS55990: "Huawei Cloud",
  AS9009: "M247",
  AS51167: "Contabo",
  AS12876: "Scaleway",
  AS36352: "ColoCrossing",
  AS46606: "Unified Layer",
  AS26496: "GoDaddy",
  AS398324: "Censys",
  AS211298: "Driftnet",
};

/** Normalises "AS15169 Google LLC" / "15169" / "as15169" to "AS15169". */
export function normalizeAsn(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const match = String(value).trim().match(/^(?:as)?\s*(\d+)/i);
  return match ? `AS${match[1]}` : null;
}

export function detectBotUserAgent(userAgent: string): string | null {
  const ua = userAgent.trim().toLowerCase();
  if (!ua) return "Empty user agent";
  for (const [pattern, label] of BOT_USER_AGENTS) {
    if (pattern.test(ua)) return label;
  }
  // Every mainstream browser sends a Mozilla/5.0 token.
  if (!ua.startsWith("mozilla/")) return "Non-browser user agent";
  return null;
}

export function detectDatacenter(network: NetworkInfo | null | undefined): string | null {
  if (!network) return null;
  const asn = normalizeAsn(network.asn);
  if (asn && DATACENTER_ASNS[asn]) {
    return `${DATACENTER_ASNS[asn]} network (${asn})`;
  }
  if (network.isHosting) {
    const owner = network.org || network.isp;
    return owner ? `Hosting network: ${owner}` : "Hosting network";
  }
  return null;
}

export function classifyClick(signals: ClickSignals): ClickClassification {
  if (signals.method && signals.method.toUpperCase() === "HEAD") {
    return { trafficType: "bot", reason: "HEAD request" };
  }

  const botReason = detectBotUserAgent(signals.userAgent);
  if (botReason) return { trafficType: "bot", reason: botReason };

  const datacenterReason = detectDatacenter(signals.network);
  if (datacenterReason) {
    return { trafficType: "datacenter", reason: datacenterReason };
  }

  if (signals.acceptLanguage !== undefined && !signals.acceptLanguage?.trim()) {
    return { trafficType: "suspicious", reason: "Missing Accept-Language header" };
  }

  if ((signals.recentClicksFromVisitor ?? 0) >= BURST_THRESHOLD) {
    return {
      trafficType: "suspicious",
      reason: `Burst: ${signals.recentClicksFromVisitor} clicks in ${BURST_WINDOW_SECONDS}s`,
    };
  }

  return { trafficType: "human", reason: null };
}

/** Clicks recorded before classification existed have no traffic_type; treat them as human. */
export function isHumanClick(click: { traffic_type?: string | null }): boolean {
  return !click.traffic_type || click.traffic_type === "human";
}

export const TRAFFIC_TYPE_LABELS: Record<TrafficType, string> = {
  human: "Human",
  bot: "Bots & link previews",
  datacenter: "Cloud / datacenter",
  suspicious: "Suspicious",
};
