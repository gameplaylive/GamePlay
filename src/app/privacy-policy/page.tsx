import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        GamePlay Live (gameplaylive.live) is operated by Cornerstone Studios. This Privacy Policy
        explains what we collect, how we use it, and your choices — including advertising (Google
        AdSense on the web and Google AdMob in our Android app).
      </p>

      <h2>1. Who we are</h2>
      <p>
        GamePlay Live is a creator-first gaming hub: we help fans discover live YouTube and Twitch
        gameplay, follow favorite creators, browse esports tournaments, and use free Go Live Studio
        tools. Official support:{" "}
        <a className="text-cyan" href="mailto:gameliveapp@gmail.com">
          gameliveapp@gmail.com
        </a>
        .
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data (Google Sign-In via Supabase Auth):</strong> name, email, and avatar
          provided by Google. We do not offer email/password or SMS login.
        </li>
        <li>
          <strong>Preferences:</strong> favorite games, language, and pinned creators.
        </li>
        <li>
          <strong>Usage signals:</strong> watch-session heartbeats (for product analytics), chat
          messages, poll votes, and basic product events needed to operate the service.
        </li>
        <li>
          <strong>Device / app signals (Android):</strong> when you use our Android wrapper, AdMob
          may receive standard mobile advertising identifiers subject to Google&apos;s policies and
          your device settings.
        </li>
      </ul>

      <h2>3. Third-party streaming APIs</h2>
      <p>
        We fetch publicly available live streams and videos via the YouTube Data API and Twitch Helix
        API. We cache titles, thumbnails, viewer counts, and channel identifiers to power discovery.
        We do not host, re-encode, or store full video files. Playback uses official YouTube/Twitch
        embeds.
      </p>

      <h2>4. Cookies, local storage &amp; advertising technology</h2>
      <p>
        We use cookies and similar technologies for authentication (Supabase sessions), preferences,
        and PWA install state.
      </p>
      <p>
        <strong>Google AdSense (web browsers only):</strong> If you browse GamePlay Live on the free
        tier in a normal browser, we may show Google AdSense ads. Third-party vendors, including
        Google, use cookies to serve ads based on your prior visits to this and other websites.
        Google&apos;s use of advertising cookies enables it and its partners to serve ads based on
        your visits. Users may opt out of personalized advertising by visiting{" "}
        <a
          className="text-cyan"
          href="https://www.google.com/settings/ads"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Ads Settings
        </a>
        . Alternatively, you can opt out of some third-party vendors&apos; use of cookies for
        personalized advertising at{" "}
        <a
          className="text-cyan"
          href="https://www.aboutads.info/choices/"
          target="_blank"
          rel="noopener noreferrer"
        >
          aboutads.info/choices
        </a>
        .
      </p>
      <p>
        Google AdSense historically used the DoubleClick DART cookie to serve ads. You can learn more
        about how Google uses data when you use our partners&apos; sites or apps at{" "}
        <a
          className="text-cyan"
          href="https://policies.google.com/technologies/partner-sites"
          target="_blank"
          rel="noopener noreferrer"
        >
          policies.google.com/technologies/partner-sites
        </a>
        .
      </p>
      <p>
        <strong>Google AdMob (Android app only):</strong> Inside our Android app WebView we do{" "}
        <em>not</em> load AdSense. Native AdMob banners are shown instead, so web and app ad
        inventory stay isolated per Google policy. You can reset or limit ad personalization in
        Android Settings → Google → Ads.
      </p>
      <p>
        <strong>Creator tools:</strong> Go Live Studio, Favorite Gamers, Squad Finder, and related
        features are free for signed-in users. Our AdSense/AdMob banners may still appear outside
        the player; YouTube/Twitch may also show their own ads inside embeds.
      </p>

      <h2>5. Analytics &amp; infrastructure</h2>
      <p>
        We use Supabase for auth, database, and product analytics needed to run GamePlay Live
        (profiles, favorites, watch telemetry). Hosting may involve Netlify or similar CDNs that
        process standard request logs. We do not sell personal information.
      </p>

      <h2>6. How we use data</h2>
      <ul>
        <li>Authenticate you and personalize Live / Latest / Favorites feeds</li>
        <li>Operate chat, polls, tournament discovery, and Go Live Studio</li>
        <li>Measure ad performance (aggregated) for AdSense/AdMob where enabled</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>7. Sharing</h2>
      <p>
        We share data with service providers only as needed to operate GamePlay Live: Supabase,
        Google (Auth, YouTube, AdSense/AdMob), Twitch, and our hosting provider. We do not sell
        personal information.
      </p>

      <h2>8. Retention &amp; deletion</h2>
      <p>
        Account data is retained while your account is active. Email{" "}
        <a className="text-cyan" href="mailto:gameliveapp@gmail.com">
          gameliveapp@gmail.com
        </a>{" "}
        to request deletion. Chat messages may remain visible to other participants until removed by
        moderation.
      </p>

      <h2>9. Children</h2>
      <p>
        GamePlay Live is not directed at children under 13 (or the minimum digital consent age in
        your region). We do not knowingly collect personal information from children.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a className="text-cyan" href="mailto:gameliveapp@gmail.com">
          gameliveapp@gmail.com
        </a>
      </p>
    </LegalShell>
  );
}
