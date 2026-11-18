import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { GuideSteps } from "@/components/guide/GuideSteps";
import { siteConfig } from "@/lib/site-config";
import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/conversion-events";

export const metadata: Metadata = {
  title: "Integration guide: track signups and purchases",
  description:
    "Add Linkto conversion tracking to any website, Shopify or WooCommerce store, or app in about 10 minutes. Copy, paste, test.",
  alternates: { canonical: "/guide" },
};

const FAQ = [
  {
    q: "Do I need my own referral or coupon system?",
    a: "No. Linkto tags each click, and the snippet reports what that visitor did. You do not create codes, links or accounts for creators on your side.",
  },
  {
    q: "Will it slow my website down?",
    a: "No. The script is under 3 KB, loads in the background (async), and only contacts Linkto when a visitor arrived through a Linkto link.",
  },
  {
    q: "What information does it collect?",
    a: "The click ID, the event name (visit, signup or purchase) and, for purchases, the amount, currency and your order number. It does not collect names, emails, phone numbers or card details.",
  },
  {
    q: "Does it use cookies?",
    a: `Yes, one first-party cookie on your own domain called lt_id, kept for ${ATTRIBUTION_WINDOW_DAYS} days. It holds the click ID and nothing else. If your site has a cookie banner, list it under analytics or marketing.`,
  },
  {
    q: "How long after a click does a purchase still count?",
    a: `${ATTRIBUTION_WINDOW_DAYS} days. If the same person clicks two creators' links, the most recent click gets the credit.`,
  },
  {
    q: "What if a visitor uses an ad blocker?",
    a: "Some ad blockers stop tracking scripts. If you need every sale counted, use the “Server (verified)” option: your server reports the sale directly, which a browser cannot block.",
  },
  {
    q: "Can someone fake a signup or a purchase?",
    a: "Anything sent from a browser can be faked by the person using it, as with every tracking script. Someone who clicked a creator's link could send made-up purchases for that creator. If money depends on the numbers, report purchases from your server (the “Server (verified)” tab) and switch on “Only count purchases sent from the server” in Linkto. Purchases are then accepted only with your secret key.",
  },
  {
    q: "Can the same order be counted twice?",
    a: "Not if you pass your order number. Linkto counts each order number once, even if the confirmation page is refreshed or both the page and your server report it.",
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label={`${siteConfig.name} home`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 p-1">
              <BrandLogo size={32} priority className="h-6 w-6" />
            </span>
            <span className="text-base font-bold tracking-tight">{siteConfig.name}</span>
          </Link>
          <span className="text-sm text-slate-600">· Integration guide</span>
          <Link href="/login" className="ml-auto inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Track signups and purchases from creator links
        </h1>
        <p className="mt-3 text-base text-slate-600">
          About 10 minutes. You copy, paste and test. No referral codes, no coupon system, no
          changes to how your site works.
        </p>

        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Paste one snippet", "On every page of your site. Visits are then counted automatically."],
            ["Mark signup and payment", "One line on your “welcome” page and one on your “order confirmed” page."],
            ["Test it", "Open your site in test mode and watch each step turn green."],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-xl border border-slate-200 p-4">
              <span
                aria-hidden
                className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700"
              >
                {i + 1}
              </span>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="install" className="mt-10">
          <h2 id="install" className="mb-4 text-xl font-bold tracking-tight">
            Install
          </h2>
          <GuideSteps origin={siteConfig.url} />
        </section>

        <section aria-labelledby="reliable" className="mt-12">
          <h2 id="reliable" className="text-xl font-bold tracking-tight">
            Paying creators on these numbers? Verify purchases
          </h2>
          <p className="mt-3 text-sm text-slate-700">
            The website snippet is the quickest setup and is fine for seeing what works. But a
            purchase reported from a web page can be faked by the visitor, and blocked by ad
            blockers. When payouts, commissions or invoices depend on the purchase numbers, make
            them verified:
          </p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700 marker:font-semibold marker:text-slate-900">
            <li>
              Keep the snippet from step 1 on your site. It still counts visits and saves the
              click ID.
            </li>
            <li>
              Report purchases from your <strong>server</strong> when the payment is confirmed,
              using your secret key. The steps are in the <strong>“Server (verified)”</strong>{" "}
              tab above.
            </li>
            <li>
              In Linkto → Conversion tracking → your website, switch on{" "}
              <strong>“Only count purchases sent from the server”</strong>.
            </li>
          </ol>
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            After that, Linkto counts a purchase only if it carries your secret key, which never
            leaves your server. Purchase numbers cannot be inflated from a browser, and ad
            blockers cannot hide real sales.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Shopify and WooCommerce setups on this page report purchases from the browser, so
            leave the switch off for those unless your server also reports orders.
          </p>
        </section>

        <section aria-labelledby="test" className="mt-12">
          <h2 id="test" className="text-xl font-bold tracking-tight">
            Test it
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700 marker:font-semibold marker:text-slate-900">
            <li>
              Open any page of your site with{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">?lt_id=lt_test_setup</code>{" "}
              added to the address, for example{" "}
              <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                https://www.yoursite.com/?lt_id=lt_test_setup
              </code>
              .
            </li>
            <li>
              A green badge appears in the bottom-left corner: <strong>“Linkto test mode: visit received ✓”</strong>.
              That means the snippet is installed correctly.
            </li>
            <li>
              In the same browser tab, sign up and place a test order. The badge shows{" "}
              <strong>“signup received ✓”</strong> and <strong>“purchase received ✓”</strong>.
            </li>
            <li>
              Done. Test events are never counted in reports. In Linkto → Conversion tracking, the
              checklist for your site shows the same three ticks.
            </li>
          </ol>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No badge? The snippet is not on that page, or the site key in it is wrong. Check step 1
            and reload.
          </p>
        </section>

        <section aria-labelledby="faq" className="mt-12">
          <h2 id="faq" className="text-xl font-bold tracking-tight">
            Common questions
          </h2>
          <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {FAQ.map((item) => (
              <div key={item.q} className="py-4">
                <dt className="text-sm font-semibold">{item.q}</dt>
                <dd className="mt-1 text-sm text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-600">
        {siteConfig.name} · Questions?{" "}
        <a href="mailto:hello@linkto.in" className="font-medium text-primary-700 hover:underline">
          hello@linkto.in
        </a>{" "}
        ·{" "}
        <Link href="/privacy" className="font-medium text-primary-700 hover:underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="font-medium text-primary-700 hover:underline">
          Terms
        </Link>
      </footer>
    </div>
  );
}
