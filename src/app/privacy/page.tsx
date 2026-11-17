import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        GamePlay Live (&quot;we&quot;, &quot;us&quot;) operates a mobile-first gaming streaming discovery PWA. This
        Privacy Policy explains what we collect, why we collect it, and how you can control your data.
      </p>
      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data via Google Sign-In (Supabase Auth):</strong> name, email address, and profile
          avatar provided by Google. We do not offer email/password or phone/SMS login.
        </li>
        <li>
          <strong>Preferences:</strong> favorite games, preferred language, pinned favorite gamers, and
          subscription tier.
        </li>
        <li>
          <strong>Usage signals:</strong> chat messages you send, poll votes, and basic product analytics
          needed to operate the service.
        </li>
        <li>
          <strong>Payment data:</strong> handled by Stripe. We store Stripe customer IDs and subscription
          status — not full card numbers.
        </li>
      </ul>
      <h2>2. Third-party content APIs</h2>
      <p>
        GamePlay Live fetches publicly available live streams and videos from the YouTube Data API and Twitch
        Helix API. We cache titles, thumbnails, viewer counts, and channel identifiers to display the feed.
        We do not scrape private content or store full video files.
      </p>
      <h2>3. Cookies & local storage</h2>
      <p>
        We use cookies/local storage for authentication sessions (Supabase), demo-mode preferences, and
        PWA install state. Advertising cookies may load only for free-tier users when AdSense is enabled
        by the site owner.
      </p>
      <h2>4. How we use data</h2>
      <ul>
        <li>Authenticate you and personalize Live / Latest / Favorites feeds</li>
        <li>Process Pro subscriptions and prevent abuse (including bans)</li>
        <li>Operate live chat and match polls</li>
        <li>Comply with legal obligations and App Store / Stripe verification requirements</li>
      </ul>
      <h2>5. Sharing</h2>
      <p>
        We share data with infrastructure providers (Supabase, Stripe, Google/Twitch APIs, hosting) solely
        to run GamePlay Live. We do not sell personal information.
      </p>
      <h2>6. Retention & deletion</h2>
      <p>
        Account data is retained while your account is active. Contact{" "}
        <a className="text-cyan" href="mailto:support@gameplaylive.app">
          support@gameplaylive.app
        </a>{" "}
        to request deletion. Chat messages may remain visible to other participants until removed by
        moderation.
      </p>
      <h2>7. Contact</h2>
      <p>
        Questions:{" "}
        <a className="text-cyan" href="mailto:support@gameplaylive.app">
          support@gameplaylive.app
        </a>
      </p>
    </LegalShell>
  );
}
