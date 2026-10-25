import { describe, expect, it } from "vitest";
import { parseUserAgent } from "@/lib/user-agent";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 609353145)",
  ipad:
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  linuxFirefox:
    "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("parseUserAgent", () => {
  it("detects iPhones as iOS mobile (previously recorded as macOS)", () => {
    expect(parseUserAgent(UA.iphoneSafari)).toEqual({
      deviceType: "mobile",
      browser: "Safari",
      os: "iOS",
    });
  });

  it("detects Android phones as Android (previously recorded as Linux)", () => {
    expect(parseUserAgent(UA.androidChrome)).toEqual({
      deviceType: "mobile",
      browser: "Chrome",
      os: "Android",
    });
  });

  it("detects tablets", () => {
    expect(parseUserAgent(UA.ipad)).toMatchObject({ deviceType: "tablet", os: "iOS" });
    expect(parseUserAgent(UA.androidTablet)).toMatchObject({
      deviceType: "tablet",
      os: "Android",
    });
  });

  it("detects in-app and alternative browsers", () => {
    expect(parseUserAgent(UA.iphoneInstagram).browser).toBe("Instagram");
    expect(parseUserAgent(UA.samsung).browser).toBe("Samsung Internet");
    expect(parseUserAgent(UA.windowsEdge).browser).toBe("Edge");
  });

  it("detects desktop platforms", () => {
    expect(parseUserAgent(UA.windowsChrome)).toEqual({
      deviceType: "desktop",
      browser: "Chrome",
      os: "Windows",
    });
    expect(parseUserAgent(UA.macSafari)).toEqual({
      deviceType: "desktop",
      browser: "Safari",
      os: "macOS",
    });
    expect(parseUserAgent(UA.linuxFirefox)).toEqual({
      deviceType: "desktop",
      browser: "Firefox",
      os: "Linux",
    });
  });
});
