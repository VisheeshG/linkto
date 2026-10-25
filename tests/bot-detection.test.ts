import { describe, expect, it } from "vitest";
import {
  BURST_THRESHOLD,
  classifyClick,
  detectBotUserAgent,
  isHumanClick,
  normalizeAsn,
} from "@/lib/bot-detection";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("detectBotUserAgent", () => {
  it.each([
    ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "Meta link preview"],
    ["meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)", "Meta link preview"],
    ["WhatsApp/2.23.20.0", "WhatsApp link preview"],
    ["Twitterbot/1.0", "X/Twitter link preview"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Google crawler"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0", "Meta link preview"],
    ["Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)", "AI crawler"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36", "Headless browser"],
    ["curl/8.4.0", "HTTP library"],
    ["python-requests/2.31.0", "HTTP library"],
    ["", "Empty user agent"],
    ["SomeRandomClient/1.0", "Non-browser user agent"],
  ])("flags %s", (ua, label) => {
    expect(detectBotUserAgent(ua)).toBe(label);
  });

  it.each([
    CHROME,
    // In-app browsers of real users must not be flagged.
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 609353145)",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.104;]",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 [Pinterest/Android]",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.0.0.40 (like Safari/8618.2.12.10.4, panda)",
  ])("does not flag real browser %s", (ua) => {
    expect(detectBotUserAgent(ua)).toBeNull();
  });
});

describe("classifyClick", () => {
  it("treats a normal browser click as human", () => {
    expect(
      classifyClick({ userAgent: CHROME, acceptLanguage: "en-IN,en;q=0.9" })
    ).toEqual({ trafficType: "human", reason: null });
  });

  it("classifies HEAD requests as bots", () => {
    expect(classifyClick({ userAgent: CHROME, method: "HEAD" }).trafficType).toBe("bot");
  });

  it("classifies known cloud networks as datacenter", () => {
    const result = classifyClick({
      userAgent: CHROME,
      acceptLanguage: "en",
      network: { asn: "AS16509 Amazon.com, Inc.", isp: "Amazon", org: "AWS", isHosting: false },
    });
    expect(result.trafficType).toBe("datacenter");
    expect(result.reason).toContain("Amazon AWS");
  });

  it("classifies Google and Meta networks as datacenter", () => {
    for (const asn of ["AS15169", "AS32934"]) {
      expect(
        classifyClick({
          userAgent: CHROME,
          acceptLanguage: "en",
          network: { asn, isp: null, org: null, isHosting: null },
        }).trafficType
      ).toBe("datacenter");
    }
  });

  it("uses the provider's hosting flag for unlisted networks", () => {
    const result = classifyClick({
      userAgent: CHROME,
      acceptLanguage: "en",
      network: { asn: "AS99999", isp: "Tiny Host", org: "Tiny Host Ltd", isHosting: true },
    });
    expect(result).toEqual({
      trafficType: "datacenter",
      reason: "Hosting network: Tiny Host Ltd",
    });
  });

  it("does not flag consumer ISPs", () => {
    expect(
      classifyClick({
        userAgent: CHROME,
        acceptLanguage: "hi-IN",
        network: { asn: "AS55836", isp: "Reliance Jio", org: "Jio", isHosting: false },
      }).trafficType
    ).toBe("human");
  });

  it("flags a browser UA without Accept-Language as suspicious", () => {
    expect(classifyClick({ userAgent: CHROME, acceptLanguage: null }).trafficType).toBe(
      "suspicious"
    );
  });

  it("skips the header check when headers are unknown (backfill)", () => {
    expect(classifyClick({ userAgent: CHROME }).trafficType).toBe("human");
  });

  it("flags click bursts as suspicious", () => {
    expect(
      classifyClick({
        userAgent: CHROME,
        acceptLanguage: "en",
        recentClicksFromVisitor: BURST_THRESHOLD,
      }).trafficType
    ).toBe("suspicious");
    expect(
      classifyClick({
        userAgent: CHROME,
        acceptLanguage: "en",
        recentClicksFromVisitor: BURST_THRESHOLD - 1,
      }).trafficType
    ).toBe("human");
  });

  it("prefers the strongest signal", () => {
    expect(
      classifyClick({
        userAgent: "facebookexternalhit/1.1",
        network: { asn: "AS32934", isp: null, org: null, isHosting: true },
      }).trafficType
    ).toBe("bot");
  });
});

describe("helpers", () => {
  it("normalizes ASNs", () => {
    expect(normalizeAsn("AS15169 Google LLC")).toBe("AS15169");
    expect(normalizeAsn("as396982")).toBe("AS396982");
    expect(normalizeAsn(16509)).toBe("AS16509");
    expect(normalizeAsn("unknown")).toBeNull();
    expect(normalizeAsn(null)).toBeNull();
  });

  it("treats unclassified rows as human", () => {
    expect(isHumanClick({ traffic_type: null })).toBe(true);
    expect(isHumanClick({})).toBe(true);
    expect(isHumanClick({ traffic_type: "human" })).toBe(true);
    expect(isHumanClick({ traffic_type: "datacenter" })).toBe(false);
  });
});
