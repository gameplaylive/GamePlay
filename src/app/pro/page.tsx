"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/** Legacy /pro URL — Creator Pro paywall removed; send people to Go Live. */
export default function ProPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/go-live");
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-sm text-muted">GamePlay Live is free for everyone.</p>
      <Link href="/go-live" className="mt-4 inline-block text-sm font-semibold text-cyan">
        Open Go Live Studio →
      </Link>
    </div>
  );
}
