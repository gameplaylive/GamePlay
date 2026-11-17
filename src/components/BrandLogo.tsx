import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg";

/** Full wordmark (icon + GAME PLAY) — wide asset */
const wordmarkSizes: Record<LogoSize, { box: string; width: number; height: number }> = {
  xs: { box: "h-7 w-[7.25rem]", width: 116, height: 40 },
  sm: { box: "h-9 w-[9.5rem]", width: 152, height: 52 },
  md: { box: "h-12 w-[12.5rem]", width: 200, height: 68 },
  lg: { box: "h-20 w-[20.5rem]", width: 328, height: 112 },
};

/** Icon-only 2×2 mark for compact slots */
const markSizes: Record<LogoSize, { box: string; img: number }> = {
  xs: { box: "h-8 w-8", img: 32 },
  sm: { box: "h-10 w-10", img: 40 },
  md: { box: "h-14 w-14", img: 56 },
  lg: { box: "h-24 w-24", img: 96 },
};

interface BrandLogoProps {
  size?: LogoSize;
  /** When true, shows the full GamePlay wordmark logo (text is in the image). */
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
  const content = withWordmark ? (
    <span className={cn("relative inline-block shrink-0", wordmarkSizes[size].box, className)}>
      <Image
        src="/brand/gameplay-live-logo-transparent.png"
        alt="GamePlay"
        width={wordmarkSizes[size].width}
        height={wordmarkSizes[size].height}
        className="h-full w-auto object-contain object-left"
        style={{ width: "auto", height: "100%" }}
        priority={priority}
        unoptimized
      />
    </span>
  ) : (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-xl",
        markSizes[size].box,
        className
      )}
    >
      <Image
        src="/brand/gameplay-mark.png"
        alt="GamePlay"
        width={markSizes[size].img}
        height={markSizes[size].img}
        className="h-full w-full object-contain"
        style={{ width: "100%", height: "auto" }}
        priority={priority}
        unoptimized
      />
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex transition hover:opacity-95" aria-label="GamePlay home">
      {content}
    </Link>
  );
}
