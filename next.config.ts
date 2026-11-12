import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Tracking snippet loaded by brand websites: let browsers and CDNs
        // reuse it for an hour instead of revalidating on every page view.
        source: "/t.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
  // Leaflet must not be bundled for SSR (maps load client-only).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), "leaflet", "react-leaflet"];
    }
    return config;
  },
};

export default nextConfig;
