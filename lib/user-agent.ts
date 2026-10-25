// Single source of truth for parsing user agents into device / browser / OS.
// Order matters: iPhone UAs contain "like Mac OS X" and Android UAs contain
// "Linux", so the mobile OSes must be checked before macOS / Linux.

export type DeviceType = "mobile" | "tablet" | "desktop";

export function getDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(ua)) return "tablet";
  // Android tablets omit "mobile" from the UA.
  if (/android/.test(ua) && !/mobile/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/.test(ua)) return "mobile";
  return "desktop";
}

export function getBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/instagram/.test(ua)) return "Instagram";
  if (/fban|fbav|fb_iab/.test(ua)) return "Facebook";
  if (/edg(e|a|ios)?\//.test(ua)) return "Edge";
  if (/opr\/|opera/.test(ua)) return "Opera";
  if (/samsungbrowser/.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/.test(ua)) return "Firefox";
  if (/chrome|crios|chromium/.test(ua)) return "Chrome";
  if (/safari/.test(ua)) return "Safari";
  return "Other";
}

export function getOS(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/windows/.test(ua)) return "Windows";
  if (/iphone|ipad|ipod|cpu (iphone )?os /.test(ua)) return "iOS";
  if (/android/.test(ua)) return "Android";
  if (/cros/.test(ua)) return "ChromeOS";
  if (/macintosh|mac os x/.test(ua)) return "macOS";
  if (/linux/.test(ua)) return "Linux";
  return "Other";
}

export function parseUserAgent(userAgent: string): {
  deviceType: DeviceType;
  browser: string;
  os: string;
} {
  return {
    deviceType: getDeviceType(userAgent),
    browser: getBrowser(userAgent),
    os: getOS(userAgent),
  };
}
