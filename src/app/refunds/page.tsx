import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = { title: "Refund & Cancellation Policy" };

export default function RefundsPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy">
      <p>
        GamePlay Live currently offers creator tools at no charge. There are no active paid
        subscriptions or in-app purchases to cancel or refund.
      </p>
      <h2>1. Free access</h2>
      <ul>
        <li>
          Go Live Studio, Favorite Gamers, Squad Finder, and related features are free for signed-in
          users.
        </li>
        <li>
          If we introduce paid plans in the future, cancellation and refund terms will be published
          here before any charges apply.
        </li>
      </ul>
      <h2>2. Legacy charges</h2>
      <ul>
        <li>
          If you were previously billed for Creator Pro via Cashfree and need help with a historical
          charge, email{" "}
          <a className="text-cyan" href="mailto:gameliveapp@gmail.com">
            gameliveapp@gmail.com
          </a>{" "}
          with your Google account email and any payment reference.
        </li>
      </ul>
      <h2>3. Contact</h2>
      <p>
        Questions:{" "}
        <a className="text-cyan" href="mailto:gameliveapp@gmail.com">
          gameliveapp@gmail.com
        </a>
        .
      </p>
    </LegalShell>
  );
}
