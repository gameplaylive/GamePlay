"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppSettingsPublic, Game, Profile, UserFavorite } from "@/lib/types";
import { DEMO_PROFILE, MOCK_GAMES, MOCK_SETTINGS } from "@/lib/mock-data";
import { DEFAULT_GAMES, DEFAULT_GAME_SLUGS, sortByDefaultGameOrder } from "@/lib/default-games";
import { createClient } from "@/lib/supabase/client";
import { OnboardingModal } from "@/components/auth/OnboardingModal";
import { AdSenseScript } from "@/components/AdSenseScript";
import { NativeAdMobSync } from "@/components/NativeAdMobSync";
import { FirebasePushOptIn } from "@/components/FirebasePushOptIn";
import { YOUTUBE_OAUTH_SCOPE } from "@/lib/go-live";

interface AppContextValue {
  profile: Profile | null;
  games: Game[];
  settings: AppSettingsPublic;
  favorites: UserFavorite[];
  loading: boolean;
  supabaseReady: boolean;
  demoMode: boolean;
  refreshProfile: () => Promise<void>;
  updateProfileLocal: (patch: Partial<Profile>) => void;
  setFavorites: (favorites: UserFavorite[]) => void;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  /** Returns provider_token if already present; otherwise starts OAuth with YouTube scope (redirect). */
  connectYouTube: (nextPath?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProviders");
  return ctx;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [games, setGames] = useState<Game[]>(MOCK_GAMES);
  const [settings, setSettings] = useState<AppSettingsPublic>(MOCK_SETTINGS);
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const supabaseReady = Boolean(supabase);

  const loadGames = useCallback(async () => {
    const allowed = new Set(DEFAULT_GAME_SLUGS as readonly string[]);
    const mergeDefaults = (rows: Game[]) => {
      const bySlug = new Map(rows.filter((g) => allowed.has(g.slug)).map((g) => [g.slug, g]));
      for (const g of DEFAULT_GAMES) {
        if (!bySlug.has(g.slug)) {
          bySlug.set(g.slug, {
            id: g.id,
            title: g.title,
            slug: g.slug,
            cover_image: g.cover_image,
            twitch_game_id: g.twitch_game_id,
            youtube_query: g.youtube_query,
            is_active: true,
          });
        }
      }
      return sortByDefaultGameOrder([...bySlug.values()]);
    };

    if (!supabase) {
      setGames(mergeDefaults(MOCK_GAMES));
      return;
    }
    const { data } = await supabase.from("games").select("*").eq("is_active", true).order("title");
    if (data?.length) {
      setGames(mergeDefaults(data as Game[]));
    } else {
      setGames(mergeDefaults(MOCK_GAMES));
    }
  }, [supabase]);

  const loadSettings = useCallback(async () => {
    if (!supabase) {
      setSettings(MOCK_SETTINGS);
      return;
    }
    const { data } = await supabase
      .from("app_settings_public")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) setSettings({ ...MOCK_SETTINGS, ...(data as AppSettingsPublic) });
  }, [supabase]);

  const loadFavorites = useCallback(
    async (userId: string) => {
      if (!supabase) {
        const raw = localStorage.getItem("gameplay_live_favorites");
        setFavorites(raw ? (JSON.parse(raw) as UserFavorite[]) : []);
        return;
      }
      const { data } = await supabase
        .from("user_favorites")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setFavorites((data as UserFavorite[]) || []);
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      const raw = localStorage.getItem("gameplay_live_demo_profile");
      if (raw) {
        setProfile(JSON.parse(raw) as Profile);
        setDemoMode(true);
      }
      setLoading(false);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setProfile(null);
      setFavorites([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    if (data) {
      setProfile(data as Profile);
      await loadFavorites(auth.user.id);
    }
    setLoading(false);
  }, [supabase, loadFavorites]);

  useEffect(() => {
    (async () => {
      await Promise.all([loadGames(), loadSettings()]);
      await refreshProfile();
    })();

    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, loadGames, loadSettings, refreshProfile]);

  const updateProfileLocal = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
        if (demoMode || !supabase) {
          localStorage.setItem("gameplay_live_demo_profile", JSON.stringify(next));
        }
        return next;
      });
    },
    [demoMode, supabase]
  );

  const enterDemo = useCallback(() => {
    const existing = localStorage.getItem("gameplay_live_demo_profile");
    const p = existing ? (JSON.parse(existing) as Profile) : { ...DEMO_PROFILE, role: "admin" as const };
    localStorage.setItem("gameplay_live_demo_profile", JSON.stringify(p));
    setDemoMode(true);
    setProfile(p);
    const raw = localStorage.getItem("gameplay_live_favorites");
    setFavorites(raw ? (JSON.parse(raw) as UserFavorite[]) : []);
    setLoading(false);
  }, []);

  const signInWithGoogle = useCallback(
    async (nextPath?: string) => {
      const next = nextPath || (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("gameplay_live_auth_next", next);
        // Cookie so /auth/callback (server) can restore destination without putting
        // ?next= on redirectTo (Supabase allow-list matches are stricter with query strings).
        document.cookie = `gameplay_live_auth_next=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax`;
      }

      if (!supabase) {
        // Supabase/Google not wired yet — local demo session, then continue to watch URL
        enterDemo();
        if (next && next !== "/" && typeof window !== "undefined") {
          window.location.assign(next);
        }
        return;
      }

      // Android WebView blocks Google's account picker — open OAuth in Chrome Custom Tabs.
      const bridge = typeof window !== "undefined" ? window.AndroidStreamBridge : undefined;
      const useNativeBrowser = Boolean(bridge?.isNativeApp?.() && bridge?.openExternalUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Exact path only — must be allow-listed in Supabase → Auth → URL Configuration.
          // Never use localhost here on production; origin comes from the live page URL.
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
          skipBrowserRedirect: useNativeBrowser,
        },
      });
      if (error) throw error;
      if (useNativeBrowser && data?.url) {
        bridge!.openExternalUrl!(data.url);
      }
    },
    [supabase, enterDemo]
  );

  const connectYouTube = useCallback(
    async (nextPath?: string) => {
      const next = nextPath || "/go-live";
      if (!supabase) {
        // Demo: pretend connected
        return "demo-youtube-token";
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const existing = sessionData.session?.provider_token;
      // If user already consented to YouTube scope, provider_token works for Live API
      if (existing && sessionStorage.getItem("gameplay_live_youtube_scope") === "1") {
        return existing;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("gameplay_live_auth_next", next);
        document.cookie = `gameplay_live_auth_next=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax`;
        sessionStorage.setItem("gameplay_live_youtube_connect", "1");
        sessionStorage.setItem("gameplay_live_youtube_scope", "1");
      }

      const bridge = typeof window !== "undefined" ? window.AndroidStreamBridge : undefined;
      const useNativeBrowser = Boolean(bridge?.isNativeApp?.() && bridge?.openExternalUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: YOUTUBE_OAUTH_SCOPE,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
          },
          skipBrowserRedirect: useNativeBrowser,
        },
      });
      if (error) throw error;
      if (useNativeBrowser && data?.url) {
        bridge!.openExternalUrl!(data.url);
      }
      return null;
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem("gameplay_live_demo_profile");
    localStorage.removeItem("gameplay_live_favorites");
    sessionStorage.removeItem("gameplay_live_youtube_scope");
    setDemoMode(false);
    setProfile(null);
    setFavorites([]);
  }, [supabase]);

  const value: AppContextValue = {
    profile,
    games,
    settings,
    favorites,
    loading,
    supabaseReady,
    demoMode,
    refreshProfile,
    updateProfileLocal,
    setFavorites,
    signInWithGoogle,
    connectYouTube,
    signOut,
    enterDemo,
  };

  const needsOnboarding =
    Boolean(profile) && (!profile?.favorite_games || profile.favorite_games.length === 0);

  return (
    <AppContext.Provider value={value}>
      <AdSenseScript />
      <NativeAdMobSync />
      <FirebasePushOptIn />
      {children}
      {needsOnboarding && <OnboardingModal />}
    </AppContext.Provider>
  );
}
