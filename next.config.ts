import type { NextConfig } from "next";

/**
 * Production CSP. Next.js hydration requires 'unsafe-inline' for bootstrap
 * scripts — without it the homepage sticks on "Loading GamePlay Live…".
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    "https://www.youtube.com",
    "https://s.ytimg.com",
    "https://player.twitch.tv",
    "https://embed.twitch.tv",
    "https://pagead2.googlesyndication.com",
    "https://*.googlesyndication.com",
    "https://www.googletagservices.com",
    "https://partner.googleadservices.com",
    "https://www.google.com",
    "https://sdk.cashfree.com",
    "https://*.supabase.co",
    "https://www.gstatic.com",
    "https://www.googleapis.com",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "https://*.firebaseapp.com",
  ].join(" "),
  [
    "frame-src",
    "https://www.youtube.com",
    "https://player.twitch.tv",
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://*.googlesyndication.com",
    "https://sdk.cashfree.com",
  ].join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  [
    "connect-src",
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://www.youtube.com",
    "https://pagead2.googlesyndication.com",
    "https://*.googlesyndication.com",
    "https://*.google.com",
    "https://*.doubleclick.net",
    "https://sdk.cashfree.com",
    "https://player.twitch.tv",
    "https://www.gstatic.com",
    "https://www.googleapis.com",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "https://fcm.googleapis.com",
    "https://firebaseinstallations.googleapis.com",
  ].join(" "),
  "worker-src 'self' blob:",
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
    // Dev/Turbopack needs inline/eval scripts; strict CSP is for production only.
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
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

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
