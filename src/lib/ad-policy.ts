/** Routes where AdSense must not render (utility / legal / empty / auth). */
const AD_BLOCKED_PREFIXES = [
  "/login",
  "/admin",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/about",
  "/contact",
  "/refunds",
  "/go-live",
  "/auth",
  "/profile",
];

export function isAdBlockedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  const path = pathname.split("?")[0] || "/";
  if (path === "/") return false;
  return AD_BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
