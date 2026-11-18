"use client";

/**
 * AdSense loader lives in `app/layout.tsx` (static head script) so Google’s
 * crawler sees `ca-pub-…` in the initial HTML. This stub remains so AppProviders
 * imports stay stable; do not add a second adsbygoogle script here.
 */
export function AdSenseScript() {
  return null;
}
