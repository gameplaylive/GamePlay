import { isPlatformAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "gpl_admin_gate";

export async function isTournamentsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (isPlatformAdminEmail(user.email)) return true;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "admin") return true;
    }
  }

  const pwd = process.env.ADMIN_PASSWORD?.trim();
  if (!pwd) return false;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === "1";
}

export function adminCookieName() {
  return ADMIN_COOKIE;
}
