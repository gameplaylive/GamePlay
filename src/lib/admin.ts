/** Platform admin — Google Sign-In email (lowercase). All other users stay role=user. */
export const PLATFORM_ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || "gameliveapp@gmail.com"
)
  .trim()
  .toLowerCase();

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
