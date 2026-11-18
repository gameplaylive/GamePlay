import { NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieNext = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("gameplay_live_auth_next="))
    ?.slice("gameplay_live_auth_next=".length);

  // Prefer query ?next= (legacy), then cookie set before OAuth, else home.
  const next = safeNextPath(searchParams.get("next") || cookieNext);

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

  const response = NextResponse.redirect(`${origin}${next}`);
  // Clear one-time post-login destination cookie
  response.cookies.set("gameplay_live_auth_next", "", { path: "/", maxAge: 0 });
  return response;
}
