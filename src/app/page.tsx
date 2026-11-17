import { Suspense } from "react";
import { HomeFeed } from "@/components/feed/HomeFeed";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading GamePlay Live…</div>
      }
    >
      <HomeFeed />
    </Suspense>
  );
}
