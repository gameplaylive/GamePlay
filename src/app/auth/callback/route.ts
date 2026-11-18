import { NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") || "/";
  const next = nextParam.startsWith("/") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code);

      // Ensure platform admin email always has role=admin (idempotent).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && isPlatformAdminEmail(user.email)) {
        const service = createServiceClient();
        if (service) {
          await service
            .from("profiles")
            .update({
              role: "admin",
              email: user.email,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
