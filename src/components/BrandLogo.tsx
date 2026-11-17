import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg";

const sizes: Record<LogoSize, { box: string; img: number }> = {
  xs: { box: "h-8 w-8", img: 32 },
  sm: { box: "h-10 w-10", img: 40 },
  md: { box: "h-14 w-14", img: 56 },
  lg: { box: "h-24 w-24", img: 96 },
};

interface BrandLogoProps {
  size?: LogoSize;
  withWordmark?: boolean;
  href?: string | null;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({
  size = "sm",
  withWordmark = false,
  href = "/",
  className,
  priority = false,
}: BrandLogoProps) {
  const s = sizes[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl",
          s.box,
          withWordmark ? "" : "ring-1 ring-white/10"
        )}
      >
        <Image
          src="/brand/gameplay-live-logo-transparent.png"
          alt="GamePlay Live"
          width={s.img}
          height={s.img}
          className="h-full w-full object-contain"
          priority={priority}
          unoptimized
        />
      </span>
      {withWordmark && (
        <span className="leading-none">
          <span className="block font-display text-[1.05em] font-bold tracking-tight text-white">
            GamePlay
          </span>
          <span className="block text-[0.72em] font-bold tracking-[0.08em] text-[#9B5CFF]">
            Live
          </span>
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex transition hover:opacity-95" aria-label="GamePlay Live home">
      {content}
    </Link>
  );
}
