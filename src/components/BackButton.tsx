"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown on every non-home page so users can leave watch / legal / tools without the dock. */
export function BackButton({
  className,
  fallbackHref = "/",
  label = "Back",
}: {
  className?: string;
  fallbackHref?: string;
  label?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || pathname === "/") return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/90 transition hover:border-cyan/40 hover:text-cyan",
        className
      )}
      aria-label={label}
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  );
}

/** Sticky top strip used by the root layout on nested routes. */
export function PageBackBar() {
  const pathname = usePathname();
  if (!pathname || pathname === "/") return null;

  return (
    <div className="sticky top-12 z-30 border-b border-white/5 bg-[#07090f]/90 px-3 py-2 backdrop-blur-xl md:top-[68px] md:px-6">
      <div className="mx-auto flex max-w-7xl items-center">
        <BackButton />
      </div>
    </div>
  );
}
