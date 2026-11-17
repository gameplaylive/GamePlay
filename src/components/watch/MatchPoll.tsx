"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { createClient } from "@/lib/supabase/client";
import type { LivePoll } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MatchPoll({ streamId }: { streamId: string }) {
  const { profile, signInWithGoogle, demoMode } = useApp();
  const [poll, setPoll] = useState<LivePoll | null>(null);
  const [voted, setVoted] = useState<"a" | "b" | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || demoMode) {
      setPoll({
        id: "demo-poll",
        stream_id: streamId,
        question: "Who wins this round?",
        option_a: "Team Alpha",
        option_b: "Team Bravo",
        votes_a: 128,
        votes_b: 97,
        is_active: true,
      });
      return;
    }
    void supabase
      .from("live_polls")
      .select("*")
      .eq("stream_id", streamId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => setPoll((data as LivePoll) || null));
  }, [streamId, demoMode]);

  if (!poll) return null;

  const total = Math.max(1, poll.votes_a + poll.votes_b);
  const pctA = Math.round((poll.votes_a / total) * 100);
  const pctB = 100 - pctA;

  async function vote(option: "a" | "b") {
    if (voted) return;
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    setVoted(option);
    setPoll((p) =>
      p
        ? {
            ...p,
            votes_a: option === "a" ? p.votes_a + 1 : p.votes_a,
            votes_b: option === "b" ? p.votes_b + 1 : p.votes_b,
          }
        : p
    );
    const supabase = createClient();
    if (!supabase || demoMode) return;
    await supabase.rpc("cast_poll_vote", { p_poll_id: poll!.id, p_option: option });
  }

  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple">Match Poll</p>
      <h4 className="mt-1 font-display text-base font-bold">{poll.question}</h4>
      <div className="mt-3 space-y-2">
        {(["a", "b"] as const).map((opt) => {
          const label = opt === "a" ? poll.option_a : poll.option_b;
          const pct = opt === "a" ? pctA : pctB;
          return (
            <button
              key={opt}
              onClick={() => void vote(opt)}
              disabled={Boolean(voted)}
              className={cn(
                "relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm font-semibold",
                voted === opt ? "border-cyan" : "border-border-glow"
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-cyan/20"
                style={{ width: voted ? `${pct}%` : "0%" }}
              />
              <span className="relative z-10 flex justify-between">
                <span>{label}</span>
                {voted && <span>{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
