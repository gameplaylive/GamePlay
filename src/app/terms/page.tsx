import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        By accessing GamePlay Live (gameplaylive.live) you agree to these Terms. If you do not
        agree, do not use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        GamePlay Live is a discovery and viewing hub that embeds official YouTube and Twitch
        players, surfaces tournament listings, and offers free studio tools for signed-in creators.
        We do not host, rebroadcast, or modify third-party video streams. Stream ownership remains
        with the original creators and platforms.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must sign in with Google (via Supabase Auth). You are responsible for activity under
        your account. We may suspend accounts for abuse, harassment, spam, illegal activity, or
        attempts to circumvent security.
      </p>

      <h2>3. User conduct</h2>
      <ul>
        <li>No harassment, hate speech, or illegal content in chat</li>
        <li>No scraping private APIs or disrupting the service</li>
        <li>No impersonation of GamePlay Live staff or creators</li>
        <li>Respect YouTube, Twitch, and applicable community guidelines when watching or going live</li>
      </ul>

      <h2>4. Embedded third-party streams</h2>
      <p>
        Playback quality, mid-roll ads inside platform players, chat on source platforms, and
        content availability are controlled by YouTube/Twitch — not GamePlay Live. We provide no
        warranty that a particular stream will remain available. Titles and thumbnails shown in our
        feed are sourced from public platform APIs for discovery only.
      </p>

      <h2>5. Creator tools (free)</h2>
      <p>
        Go Live Studio (mobile + OBS / RTMP), Favorite Gamers, Squad Finder, go-live alerts, and
        related creator tools are free for every signed-in user. We may introduce optional paid plans
        later; pricing and terms would be disclosed clearly before any charge.
      </p>
      <ul>
        <li>Platform embeds may still show YouTube/Twitch&apos;s own ads</li>
        <li>Features may evolve; material changes will be communicated in-app when practical</li>
      </ul>

      <h2>6. Advertising</h2>
      <p>
        Web users may see Google AdSense banners and Android app users may see Google AdMob banners
        outside the video player. Clicking ads fraudulently or encouraging invalid traffic is
        prohibited and may result in bans.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        GamePlay Live branding, UI, and original editorial text are owned by Cornerstone Studios.
        Third-party logos, stream content, and trademarks belong to their respective owners.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        GamePlay Live is provided &quot;as is&quot;. To the maximum extent permitted by law, we are
        not liable for indirect, incidental, or consequential damages arising from third-party
        streams, payment processors, or service interruptions.
      </p>

      <h2>9. Contact</h2>
      <p>
        <a className="text-cyan" href="mailto:gameplayliveapp@gmail.com">
          gameplayliveapp@gmail.com
        </a>
      </p>
    </LegalShell>
  );
}
