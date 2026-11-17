import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        By accessing GamePlay Live you agree to these Terms. If you do not agree, do not use the service.
      </p>
      <h2>1. The service</h2>
      <p>
        GamePlay Live is a discovery and viewing hub that embeds official YouTube and Twitch players. We do not
        host, rebroadcast, or modify third-party video streams. Stream ownership remains with the original
        creators and platforms.
      </p>
      <h2>2. Accounts</h2>
      <p>
        You must sign in with Google. You are responsible for activity under your account. We may suspend
        accounts that are banned for abuse, harassment, spam, or illegal activity.
      </p>
      <h2>3. User conduct</h2>
      <ul>
        <li>No harassment, hate speech, or illegal content in chat</li>
        <li>No attempts to bypass Pro paywalls, scrape private APIs, or disrupt the service</li>
        <li>No impersonation of GamePlay Live staff or creators</li>
      </ul>
      <h2>4. Subscriptions (GamePlay Live Pro)</h2>
      <p>
        Pro is a paid digital subscription billed through Stripe. Reference consumer pricing may be shown
        as approximately ₹99/month (or the USD equivalent configured by the operator, default $2.00 USD).
        Exact charged amount is displayed at checkout and may vary by currency and taxes.
      </p>
      <ul>
        <li>Benefits may include ad-free browsing, 2×2 multi-stream grid, and a Gold PRO chat badge</li>
        <li>Subscriptions renew monthly until canceled</li>
        <li>Features remain subject to change with notice in-app</li>
      </ul>
      <h2>5. Third-party embeds & disclaimers</h2>
      <p>
        Playback quality, ads inside platform players, chat moderation on source platforms, and content
        availability are controlled by YouTube/Twitch — not GamePlay Live. We provide no warranty that a
        particular stream will remain available.
      </p>
      <h2>6. Limitation of liability</h2>
      <p>
        GamePlay Live is provided &quot;as is&quot;. To the maximum extent permitted by law, we are not liable
        for indirect, incidental, or consequential damages arising from use of third-party streams or
        service interruptions.
      </p>
      <h2>7. Contact</h2>
      <p>
        <a className="text-cyan" href="mailto:support@gameplaylive.app">
          support@gameplaylive.app
        </a>
      </p>
    </LegalShell>
  );
}
