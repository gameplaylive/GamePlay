import Link from "next/link";
import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = {
  title: "About GamePlay Live",
  description:
    "Learn how GamePlay Live curates YouTube & Twitch gaming streams, tournaments, and free creator tools.",
};

export default function AboutPage() {
  return (
    <LegalShell title="About GamePlay Live">
      <p>
        <strong>GamePlay Live</strong> (gameplaylive.live) is a creator-first gaming hub built for
        fans and streamers in India and worldwide. We make it easy to discover what&apos;s live,
        follow creators you care about, and go live with free studio tools.
      </p>

      <h2>Our mission</h2>
      <p>
        Great gameplay moments are scattered across YouTube and Twitch. Our mission is to bring those
        moments into one focused, mobile-friendly place — with clear game categories, language
        filters, tournament context, and tools that help Indian creators grow without fighting
        complex software alone.
      </p>

      <h2>How we curate streams</h2>
      <ul>
        <li>
          We use official <strong>YouTube Data API</strong> and <strong>Twitch Helix</strong>{" "}
          endpoints to find public live gameplay and trending gaming videos.
        </li>
        <li>
          Results are classified into our top games (BGMI, Free Fire, Valorant, GTA V, Minecraft,
          Roblox, CS2, Dota 2, Fortnite, Call of Duty) using title and category signals.
        </li>
        <li>
          Playback always uses the official YouTube or Twitch player embed. We do not rehost or
          rebroadcast streams — creators and platforms keep ownership.
        </li>
        <li>
          Feeds refresh on a quota-safe schedule so discovery stays fresh without burning API limits.
        </li>
      </ul>

      <h2>What you can do here</h2>
      <ul>
        <li>
          <strong>Watch:</strong> browse Live Now and Latest, filter by game and language, and open
          a single clean player with chat and related streams.
        </li>
        <li>
          <strong>Follow:</strong> pin favorite gamers and get notified when they go live.
        </li>
        <li>
          <strong>Tournaments:</strong> track curated esports and mobile events in one hub.
        </li>
        <li>
          <strong>Create:</strong> Go Live Studio (mobile + OBS), presets, and go-live alerts are
          free for every signed-in creator.
        </li>
      </ul>

      <h2>Advertising</h2>
      <p>
        GamePlay Live may show Google AdSense banners on the website and Google AdMob banners in our
        Android app (outside the video player — not inside YouTube/Twitch embeds). These help keep
        the hub running for everyone. Details are in our{" "}
        <Link href="/privacy-policy" className="text-cyan">
          Privacy Policy
        </Link>
        .
      </p>

      <h2>Who builds this</h2>
      <p>
        GamePlay Live is developed by Cornerstone Studios. Questions, partnerships, or AdSense /
        verification requests:{" "}
        <a className="text-cyan" href="mailto:gameplayliveapp@gmail.com">
          gameplayliveapp@gmail.com
        </a>
        .
      </p>

      <p>
        Explore the hub:{" "}
        <Link href="/" className="text-cyan">
          Live feed
        </Link>
        {" · "}
        <Link href="/tournaments" className="text-cyan">
          Tournaments
        </Link>
        {" · "}
        <Link href="/games" className="text-cyan">
          Games
        </Link>
        {" · "}
        <Link href="/contact" className="text-cyan">
          Contact
        </Link>
        .
      </p>
    </LegalShell>
  );
}
