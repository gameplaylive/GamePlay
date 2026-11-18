import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-white">Page not found</h1>
      <p className="mt-3 text-sm text-muted">
        That link doesn&apos;t exist on GamePlay Live. Head back to live gameplay, tournaments, or
        contact support.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary rounded-full px-5 py-2.5 text-sm">
          Live feed
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-border-glow px-5 py-2.5 text-sm text-muted hover:text-white"
        >
          Contact
        </Link>
      </div>
    </div>
  );
}
