import type { Profile } from "@/lib/types";

/**
 * Launch model: every signed-in user gets full creator features.
 * `subscription_tier` columns remain in the DB but are not used for paywalls.
 */
export function isSignedIn(profile: Profile | null | undefined): boolean {
  return Boolean(profile?.id);
}

/** @deprecated Paywalls removed — always true when a profile exists. */
export function hasCreatorAccess(profile: Profile | null | undefined): boolean {
  return isSignedIn(profile);
}
