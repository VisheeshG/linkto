/**
 * Converts common social / media web URLs into native app opens on mobile.
 * Android uses intent:// URLs; iOS uses custom URL schemes.
 */

export type MobileRedirectTargets = {
  webUrl: string;
  /** iOS / generic custom-scheme URL */
  appUrl: string | null;
  /** Chrome on Android */
  androidIntent: string | null;
};

const ANDROID_PACKAGES: Record<string, string> = {
  youtube: "com.google.android.youtube",
  instagram: "com.instagram.android",
  tiktok: "com.zhiliaoapp.musically",
  twitter: "com.twitter.android",
  facebook: "com.facebook.katana",
  spotify: "com.spotify.music",
};

function buildAndroidIntent(webUrl: string, packageId: string): string {
  const parsed = new URL(webUrl);
  const path = `${parsed.host}${parsed.pathname}${parsed.search}`;
  return `intent://${path}#Intent;scheme=https;package=${packageId};S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
}

function extractYouTubeVideoId(url: URL): string | null {
  if (url.hostname === "youtu.be" || url.hostname.endsWith(".youtu.be")) {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return id || null;
  }
  const v = url.searchParams.get("v");
  if (v) return v;
  const shorts = url.pathname.match(/\/shorts\/([^/?]+)/);
  if (shorts) return shorts[1];
  const embed = url.pathname.match(/\/embed\/([^/?]+)/);
  if (embed) return embed[1];
  return null;
}

function resolveYouTube(webUrl: string, os: string): MobileRedirectTargets {
  let parsed: URL;
  try {
    parsed = new URL(webUrl);
  } catch {
    return { webUrl, appUrl: null, androidIntent: null };
  }

  const videoId = extractYouTubeVideoId(parsed);
  const pathWithQuery = `${parsed.pathname}${parsed.search}`;

  if (os === "Android") {
    return {
      webUrl,
      appUrl: null,
      androidIntent: buildAndroidIntent(webUrl, ANDROID_PACKAGES.youtube),
    };
  }

  if (videoId) {
    const appUrl = `youtube://www.youtube.com/watch?v=${videoId}`;
    return { webUrl, appUrl, androidIntent: null };
  }

  // Podcasts, playlists, channels — open YouTube app at same path
  const appUrl = `youtube://www.youtube.com${pathWithQuery}`;
  return { webUrl, appUrl, androidIntent: null };
}

function resolveInstagram(webUrl: string, os: string): MobileRedirectTargets {
  let parsed: URL;
  try {
    parsed = new URL(webUrl);
  } catch {
    return { webUrl, appUrl: null, androidIntent: null };
  }

  const path = parsed.pathname.replace(/\/$/, "") || "/";
  const appUrl = `instagram://www.instagram.com${path}${parsed.search}`;

  if (os === "Android") {
    return {
      webUrl,
      appUrl,
      androidIntent: buildAndroidIntent(webUrl, ANDROID_PACKAGES.instagram),
    };
  }

  return { webUrl, appUrl, androidIntent: null };
}

function resolveTikTok(webUrl: string, os: string): MobileRedirectTargets {
  if (os === "Android") {
    return {
      webUrl,
      appUrl: null,
      androidIntent: buildAndroidIntent(webUrl, ANDROID_PACKAGES.tiktok),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(webUrl);
  } catch {
    return { webUrl, appUrl: null, androidIntent: null };
  }

  const appUrl = `snssdk1233://${parsed.host}${parsed.pathname}${parsed.search}`;
  return { webUrl, appUrl, androidIntent: null };
}

function resolveTwitter(webUrl: string, os: string): MobileRedirectTargets {
  let parsed: URL;
  try {
    parsed = new URL(webUrl);
  } catch {
    return { webUrl, appUrl: null, androidIntent: null };
  }

  const statusMatch = parsed.pathname.match(/\/status\/(\d+)/);
  let appUrl: string | null = null;

  if (statusMatch) {
    appUrl = `twitter://status?id=${statusMatch[1]}`;
  } else {
    appUrl = `twitter://${parsed.host}${parsed.pathname}${parsed.search}`;
  }

  if (os === "Android") {
    return {
      webUrl,
      appUrl,
      androidIntent: buildAndroidIntent(webUrl, ANDROID_PACKAGES.twitter),
    };
  }

  return { webUrl, appUrl, androidIntent: null };
}

function resolveSpotify(webUrl: string, os: string): MobileRedirectTargets {
  let parsed: URL;
  try {
    parsed = new URL(webUrl);
  } catch {
    return { webUrl, appUrl: null, androidIntent: null };
  }

  const path = parsed.pathname + parsed.search;
  const appUrl = `spotify:${path}`;

  if (os === "Android") {
    return {
      webUrl,
      appUrl,
      androidIntent: buildAndroidIntent(webUrl, ANDROID_PACKAGES.spotify),
    };
  }

  return { webUrl, appUrl, androidIntent: null };
}

function detectPlatform(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be" ||
    host.endsWith(".youtube.com")
  ) {
    return "youtube";
  }
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    return "instagram";
  }
  if (
    host === "tiktok.com" ||
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com" ||
    host.endsWith(".tiktok.com")
  ) {
    return "tiktok";
  }
  if (
    host === "twitter.com" ||
    host === "x.com" ||
    host === "mobile.twitter.com"
  ) {
    return "twitter";
  }
  if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch") {
    return "facebook";
  }
  if (host === "open.spotify.com" || host === "spotify.com") {
    return "spotify";
  }

  return null;
}

/** Resolve native-app targets from a destination URL and device OS. */
export function resolveMobileAppRedirect(
  destinationUrl: string,
  os: string
): MobileRedirectTargets | null {
  let parsed: URL;
  try {
    parsed = new URL(destinationUrl);
  } catch {
    return null;
  }

  if (!["Android", "iOS"].includes(os)) {
    return null;
  }

  const platform = detectPlatform(parsed.hostname);
  if (!platform) return null;

  switch (platform) {
    case "youtube":
      return resolveYouTube(destinationUrl, os);
    case "instagram":
      return resolveInstagram(destinationUrl, os);
    case "tiktok":
      return resolveTikTok(destinationUrl, os);
    case "twitter":
      return resolveTwitter(destinationUrl, os);
    case "spotify":
      return resolveSpotify(destinationUrl, os);
    case "facebook":
      if (os === "Android") {
        return {
          webUrl: destinationUrl,
          appUrl: null,
          androidIntent: buildAndroidIntent(
            destinationUrl,
            ANDROID_PACKAGES.facebook
          ),
        };
      }
      return {
        webUrl: destinationUrl,
        appUrl: `fb://${parsed.host}${parsed.pathname}${parsed.search}`,
        androidIntent: null,
      };
    default:
      return null;
  }
}

export function canOpenInNativeApp(destinationUrl: string): boolean {
  try {
    const parsed = new URL(destinationUrl);
    return detectPlatform(parsed.hostname) !== null;
  } catch {
    return false;
  }
}

/** JSON string literal that is safe to embed inside an inline <script>. */
function toScriptLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Minimal HTML page: try native app, then fall back to web URL. */
export function buildMobileAppRedirectHtml(targets: MobileRedirectTargets): string {
  const webUrl = toScriptLiteral(targets.webUrl);
  const appUrl = targets.appUrl ? toScriptLiteral(targets.appUrl) : "null";
  const androidIntent = targets.androidIntent
    ? toScriptLiteral(targets.androidIntent)
    : "null";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening…</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
    p { text-align: center; padding: 1rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <p>Opening in app…<br /><a id="fallback" href="#">Continue in browser</a></p>
  <script>
    (function () {
      var webUrl = ${webUrl};
      var appUrl = ${appUrl};
      var androidIntent = ${androidIntent};
      var ua = navigator.userAgent || "";
      var isAndroid = /android/i.test(ua);
      var link = document.getElementById("fallback");
      link.href = webUrl;
      link.textContent = "Continue in browser";
      function openWeb() { window.location.replace(webUrl); }
      function tryApp() {
        if (isAndroid && androidIntent) {
          window.location.href = androidIntent;
        } else if (appUrl) {
          window.location.href = appUrl;
        } else {
          openWeb();
          return;
        }
        setTimeout(openWeb, 2500);
      }
      tryApp();
    })();
  </script>
</body>
</html>`;
}
