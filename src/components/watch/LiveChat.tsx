"use client";

import { FormEvent, useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LiveChat({ streamId }: { streamId: string }) {
  const { profile, signInWithGoogle, demoMode } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || demoMode) {
      setMessages([
        {
          id: "1",
          stream_id: streamId,
          user_id: "x",
          user_name: "AceFan",
          user_avatar: "",
          is_pro: true,
          message: "Let's gooo 🔥",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          stream_id: streamId,
          user_id: "y",
          user_name: "ScrimKid",
          user_avatar: "",
          is_pro: false,
          message: "Clutch or kick?",
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    void supabase
      .from("chat_messages")
      .select("*")
      .eq("stream_id", streamId)
      .order("created_at", { ascending: true })
      .limit(80)
      .then(({ data }) => setMessages((data as ChatMessage[]) || []));

    const channel = supabase
      .channel(`chat:${streamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `stream_id=eq.${streamId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as ChatMessage])
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [streamId, demoMode]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    const payload: ChatMessage = {
      id: crypto.randomUUID(),
      stream_id: streamId,
      user_id: profile.id,
      user_name: profile.full_name || "Player",
      user_avatar: profile.avatar_url || "",
      is_pro: profile.subscription_tier === "pro",
      message: text.trim(),
      created_at: new Date().toISOString(),
    };
    setText("");
    const supabase = createClient();
    if (!supabase || demoMode) {
      setMessages((prev) => [...prev, payload]);
      return;
    }
    await supabase.from("chat_messages").insert({
      stream_id: streamId,
      user_id: profile.id,
      user_name: payload.user_name,
      user_avatar: payload.user_avatar,
      is_pro: payload.is_pro,
      message: payload.message,
    });
  }

  return (
    <div className="glass flex h-full min-h-[280px] flex-col rounded-2xl">
      <div className="border-b border-border-glow px-4 py-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider">Live Chat</h3>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className={cn("mr-2 font-bold", m.is_pro ? "text-gold" : "text-cyan")}>
              {m.user_name}
              {m.is_pro && (
                <span className="ml-1 rounded bg-gold/20 px-1 text-[9px] font-black text-gold">PRO</span>
              )}
            </span>
            <span className="text-white/90">{m.message}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border-glow p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={profile ? "Say something…" : "Sign in to chat"}
          className="flex-1 rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2 text-sm outline-none focus:border-cyan"
          maxLength={500}
        />
        <button type="submit" className="rounded-xl bg-cyan px-3 py-2 text-sm font-bold text-obsidian">
          Send
        </button>
      </form>
    </div>
  );
}
