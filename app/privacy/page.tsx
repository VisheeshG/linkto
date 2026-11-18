import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/conversion-events";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Linkto collects when someone clicks a tracking link, what the conversion snippet stores, and how account data is handled.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="19 November 2026"
      intro="Linkto is a link tracking service for brands, agencies and creators. This page explains what information Linkto handles, in three situations: when you have a Linkto account, when you click a Linkto link, and when you visit a website that uses the Linkto conversion snippet."
    >
      <LegalSection title="If you have a Linkto account">
        <p>We store the details you give us to run your account:</p>
        <ul>
          <li>Your email address and name, and your company name if you add one.</li>
          <li>The brands, campaigns, links and website entries you create.</li>
          <li>Passwords for shared reports, stored only as one-way hashes.</li>
        </ul>
        <p>
          We use this to sign you in, show your reports and contact you about the service. We do
          not sell it.
        </p>
      </LegalSection>

      <LegalSection title="If you click a Linkto link">
        <p>
          When a Linkto tracking link is opened, we record the click for the owner of that link
          and then send you on to the destination. For each click we record:
        </p>
        <ul>
          <li>Which link was clicked and the creator name in its address.</li>
          <li>The time of the click and the page that referred you, if your browser sends it.</li>
          <li>Your IP address, and from it an approximate location (country, region, city) and network provider.</li>
          <li>Your browser&apos;s user agent, and from it your device type, browser and operating system.</li>
          <li>
            A hashed visitor identifier made from your IP address and user agent, used to count
            unique visitors and detect automated traffic.
          </li>
        </ul>
        <p>
          Linkto&apos;s reports show the link owner grouped statistics and click rows without IP addresses or
          user agents. Linkto does not set a cookie on your device when you click a link.
        </p>
        <p>
          The destination address may have a click ID added to it (<code>lt_id</code>). It is a
          random value that identifies the click, not you.
        </p>
      </LegalSection>

      <LegalSection title="If you visit a website that uses the Linkto snippet">
        <p>
          Some websites add a small Linkto script so they can see which creator&apos;s link led to
          a visit, a signup or a purchase. If you arrived through a Linkto link, the script:
        </p>
        <ul>
          <li>
            Stores the click ID in a first-party cookie on that website&apos;s own domain, named{" "}
            <code>lt_id</code>, for {ATTRIBUTION_WINDOW_DAYS} days, with a copy in the browser&apos;s
            local storage.
          </li>
          <li>
            Reports events to Linkto: the visit, and a signup or purchase if the website marks one.
            A purchase includes the amount, currency and the website&apos;s order number.
          </li>
          <li>
            May include a customer ID chosen by the website, so later purchases can be matched to
            the same click.
          </li>
        </ul>
        <p>
          The script does not collect names, email addresses, phone numbers or payment card
          details, and it sends nothing for visitors who did not arrive through a Linkto link.
          The website that installed it decides what to send and is responsible for telling its
          visitors and, where the law requires it, asking for consent.
        </p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>We rely on other companies to run Linkto. They process data on our behalf:</p>
        <ul>
          <li>Supabase: database and sign-in.</li>
          <li>Vercel: hosting and anonymous usage analytics for linkto.in.</li>
          <li>ip-api.com and ipapi.co: turning an IP address into an approximate location and network.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <p>
          Account data is kept while the account exists. Click and conversion data is kept until
          the owner deletes the link, campaign or account it belongs to; deleting one removes its
          clicks and conversions with it.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul>
          <li>Account holders can delete links, campaigns and websites at any time from the dashboard.</li>
          <li>
            Visitors can remove the <code>lt_id</code> cookie by clearing cookies for the website
            they visited.
          </li>
          <li>
            To ask what we hold about you, or to have it corrected or deleted, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary-700 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If this policy changes in a way that matters, we will update the date above and, for
          account holders, tell you by email.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
