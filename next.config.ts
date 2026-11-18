import type { NextConfig } from "next";

/** Blocks Netlify edge-injected inline badge scripts; keeps YT/Twitch/AdSense/Supabase/Cashfree. */
const contentSecurityPolicy = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "https://www.youtube.com",
    "https://s.ytimg.com",
    "https://player.twitch.tv",
    "https://embed.twitch.tv",
    "https://pagead2.googlesyndication.com",
    "https://sdk.cashfree.com",
    "https://*.supabase.co",
  ].join(" "),
  [
    "frame-src",
    "https://www.youtube.com",
    "https://player.twitch.tv",
    "https://googleads.g.doubleclick.net",
    "https://sdk.cashfree.com",
  ].join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.youtube.com https://pagead2.googlesyndication.com https://sdk.cashfree.com https://player.twitch.tv",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
