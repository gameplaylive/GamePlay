import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = { title: "Refund & Cancellation Policy" };

export default function RefundsPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy">
      <p>
        This policy covers GamePlay Live Pro digital subscriptions processed by Stripe. It is designed to meet
        App Store review and Stripe verification expectations for clear cancellation and refund terms.
      </p>
      <h2>1. Cancellation</h2>
      <ul>
        <li>
          You may cancel auto-renewal at any time from the Stripe customer portal or by emailing{" "}
          <a className="text-cyan" href="mailto:support@gameplaylive.app">
            support@gameplaylive.app
          </a>
          .
        </li>
        <li>After cancellation, Pro access continues until the end of the current billing period.</li>
        <li>Canceling stops future charges; it does not automatically refund the current period.</li>
      </ul>
      <h2>2. Refunds</h2>
      <ul>
        <li>
          Because Pro is a digital service delivered immediately, purchases are generally non-refundable
          once the billing period has started.
        </li>
        <li>
          We may issue a goodwill refund within 7 days of the first charge if you experienced a verified
          billing error, duplicate charge, or were unable to access Pro features due to a GamePlay Live-side
          outage.
        </li>
        <li>Refund requests should include the Google account email used on GamePlay Live and the Stripe receipt.</li>
      </ul>
      <h2>3. Chargebacks</h2>
      <p>
        Please contact support before filing a chargeback so we can resolve the issue. Confirmed fraudulent
        chargebacks may result in account suspension.
      </p>
      <h2>4. How to request help</h2>
      <p>
        Email{" "}
        <a className="text-cyan" href="mailto:support@gameplaylive.app">
          support@gameplaylive.app
        </a>{" "}
        with subject line &quot;Refund Request&quot; or use the{" "}
        <a className="text-cyan" href="/contact">
          Contact
        </a>{" "}
        page. We aim to respond within 2 business days.
      </p>
    </LegalShell>
  );
}
