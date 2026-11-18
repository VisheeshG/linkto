import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using Linkto's link tracking and conversion tracking service.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="19 November 2026"
      intro="These terms apply when you create a Linkto account or use Linkto's tracking links, reports, conversion snippet or API. By using the service you agree to them."
    >
      <LegalSection title="Your account">
        <ul>
          <li>Give accurate sign-up details and keep your password and secret keys private.</li>
          <li>You are responsible for what happens under your account, including links and websites you add.</li>
          <li>Tell us promptly if you think someone else has access to your account or keys.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You may not use Linkto to:</p>
        <ul>
          <li>Link to malware, phishing, scams or content that is illegal where you or your audience are.</li>
          <li>Send spam or mislead people about where a link goes.</li>
          <li>Generate fake clicks, signups or purchases, or misreport results to a client or creator.</li>
          <li>Probe, overload or interfere with the service, or use it to attack other systems.</li>
        </ul>
        <p>We may disable links or suspend accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="Using the conversion snippet and API">
        <ul>
          <li>
            If you install the Linkto snippet or send events from your server, you are responsible
            for having the right to do so on that website or app, for telling its visitors, and
            for collecting consent where the law requires it. Our{" "}
            <Link href="/privacy" className="font-medium text-primary-700 hover:underline">
              privacy policy
            </Link>{" "}
            describes what the snippet stores.
          </li>
          <li>Do not send personal information such as names, emails or phone numbers in events.</li>
          <li>Keep secret keys on your server. Never put them in a web page or app.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Accuracy of reports">
        <p>
          Linkto reports what it receives. Clicks are filtered for bots on a best-effort basis.
          Events sent from a browser can be blocked by ad blockers or forged by a visitor; only
          purchases sent from a website&apos;s server with its secret key are verified. Before paying
          anyone on the basis of a report, check it against your own order records.
        </p>
      </LegalSection>

      <LegalSection title="Your data">
        <p>
          The campaigns, links and results in your account are yours. We process them to provide
          the service, as described in the privacy policy. You can delete them at any time.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We work to keep Linkto running and links redirecting, but the service is provided as
          it is, without a guarantee of uninterrupted availability. We may change or remove
          features, and will give reasonable notice of changes that materially reduce what you
          rely on.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          To the extent the law allows, Linkto is not liable for indirect or consequential
          losses, lost profits or lost data arising from use of the service, or for decisions
          made on the basis of its reports.
        </p>
      </LegalSection>

      <LegalSection title="Ending use">
        <p>
          You can stop using Linkto at any time. We may suspend or close an account that breaks
          these terms. Tracking links stop redirecting when the links or account behind them are
          deleted.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary-700 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
