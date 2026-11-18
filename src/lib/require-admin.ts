import { isPlatformAdminEmail } from "@/lib/admin";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Authenticated admin (role=admin or platform owner email). */
export async function requireAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (isPlatformAdminEmail(user.email)) return user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_banned")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_banned || profile.role !== "admin") return null;
  return user;
}

export function requireServiceClient() {
  return createServiceClient();
}
