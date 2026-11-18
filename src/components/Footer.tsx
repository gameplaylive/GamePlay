import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const links = [
  { href: "/about", label: "About" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 bg-[#07090f]/80 pb-28 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <BrandLogo size="sm" withWordmark />
          <p className="mt-2 max-w-md text-sm text-muted">
            GamePlay Live curates public YouTube &amp; Twitch gameplay, tournaments, and Creator Pro
            studio tools. Streams remain property of their creators.
          </p>
          <p className="mt-2 text-xs text-muted">
            Support:{" "}
            <a className="text-cyan hover:underline" href="mailto:gameliveapp@gmail.com">
              gameliveapp@gmail.com
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-cyan">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-3 text-center text-[11px] text-muted">
        © {new Date().getFullYear()} GamePlay Live · Cornerstone Studios · gameplaylive.live
      </div>
    </footer>
  );
}
