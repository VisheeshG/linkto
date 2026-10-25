import { describe, expect, it } from "vitest";
import { applyUtmParameters } from "@/lib/utm";
import { isLinkExpired, parseCreatorAndSubmission } from "@/lib/tracking-redirect";
import { buildMobileAppRedirectHtml } from "@/lib/mobile-app-redirect";
import { geoFromPlatformHeaders } from "@/lib/geo";

describe("applyUtmParameters", () => {
  const ctx = {
    platform: "YouTube",
    projectSlug: "diwali-launch",
    creatorUsername: "alice",
    submissionNumber: "sub2",
  };

  it("adds UTM parameters", () => {
    const url = new URL(applyUtmParameters("https://shop.example.com/p?id=1", ctx));
    expect(url.searchParams.get("id")).toBe("1");
    expect(url.searchParams.get("utm_source")).toBe("linkto");
    expect(url.searchParams.get("utm_medium")).toBe("youtube");
    expect(url.searchParams.get("utm_campaign")).toBe("diwali-launch");
    expect(url.searchParams.get("utm_content")).toBe("alice");
    expect(url.searchParams.get("utm_term")).toBe("sub2");
  });

  it("never overrides existing UTM parameters", () => {
    const url = new URL(
      applyUtmParameters("https://shop.example.com/?utm_source=newsletter", ctx)
    );
    expect(url.searchParams.get("utm_source")).toBe("newsletter");
    expect(url.searchParams.get("utm_medium")).toBe("youtube");
  });

  it("leaves invalid URLs untouched", () => {
    expect(applyUtmParameters("not a url", ctx)).toBe("not a url");
  });
});

describe("link expiry", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  it("expires links at or after expires_at", () => {
    expect(isLinkExpired({ expires_at: null }, now)).toBe(false);
    expect(isLinkExpired({ expires_at: "2026-10-26T00:00:00Z" }, now)).toBe(false);
    expect(isLinkExpired({ expires_at: "2026-10-25T12:00:00Z" }, now)).toBe(true);
  });
});

describe("parseCreatorAndSubmission", () => {
  it("uses the URL submission when valid", () => {
    expect(parseCreatorAndSubmission(["alice", "sub3"], { submission_number: "sub1" })).toEqual({
      creatorUsername: "alice",
      submissionNumber: "sub3",
      valid: true,
    });
  });

  it("falls back to the link's submission", () => {
    expect(parseCreatorAndSubmission(["alice"], { submission_number: "sub1" })).toMatchObject({
      submissionNumber: "sub1",
      valid: true,
    });
  });

  it("rejects malformed submissions", () => {
    expect(parseCreatorAndSubmission(["alice", "evil"], { submission_number: null }).valid).toBe(
      false
    );
  });
});

describe("buildMobileAppRedirectHtml", () => {
  it("escapes URLs embedded in the inline script", () => {
    const html = buildMobileAppRedirectHtml({
      webUrl: "https://example.com/</script><script>alert(1)</script>",
      appUrl: null,
      androidIntent: null,
    });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script\\u003e");
  });
});

describe("geoFromPlatformHeaders", () => {
  it("maps Vercel geo headers to country names and decoded cities", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "IN",
      "x-vercel-ip-city": "New%20Delhi",
    });
    expect(geoFromPlatformHeaders(headers)).toEqual({
      country: "India",
      state: null,
      city: "New Delhi",
      network: null,
    });
  });
});
