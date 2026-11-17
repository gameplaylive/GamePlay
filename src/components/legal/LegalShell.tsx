export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated: November 16, 2026</p>
      <div className="glass mt-8 space-y-5 rounded-3xl p-6 text-sm leading-relaxed text-white/85 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
