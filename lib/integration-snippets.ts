/**
 * Copy-paste integration code, shared by the in-app Integration page (filled
 * with the site's real key) and the public guide (placeholders).
 */

export const PLACEHOLDER_SITE_KEY = "YOUR_SITE_KEY";
export const PLACEHOLDER_SECRET_KEY = "YOUR_SECRET_KEY";

export type SnippetContext = {
  /** Where Linkto is served from, e.g. https://linkto.in */
  origin: string;
  siteKey: string;
  secretKey?: string;
  currency?: string;
};

export type IntegrationStep = {
  title: string;
  /** Where to paste it, in one or two plain sentences. */
  body: string;
  code?: string;
  /** Short reassurance shown under the code. */
  note?: string;
};

export type IntegrationPlatform = {
  id: "website" | "shopify" | "woocommerce" | "gtm" | "server";
  label: string;
  summary: string;
  steps: IntegrationStep[];
};

const STUB = "window.linkto=window.linkto||function(){(linkto.q=linkto.q||[]).push(arguments)};";

export function baseSnippet({ origin, siteKey }: SnippetContext): string {
  return [
    "<!-- Linkto tracking -->",
    `<script>${STUB}</script>`,
    `<script async src="${origin}/t.js" data-site="${siteKey}"></script>`,
  ].join("\n");
}

export function signupSnippet(): string {
  return ["<script>", '  linkto("signup");', "</script>"].join("\n");
}

export function purchaseSnippet({ currency = "INR" }: Pick<SnippetContext, "currency">): string {
  return [
    "<script>",
    '  linkto("purchase", {',
    "    amount: 499,          // what the customer paid",
    `    currency: "${currency}",`,
    '    orderId: "ORDER-1001" // your order number',
    "  });",
    "</script>",
  ].join("\n");
}

export function serverSnippet(
  { origin, secretKey = PLACEHOLDER_SECRET_KEY, currency = "INR" }: SnippetContext,
  event: "signup" | "purchase"
): string {
  const payload =
    event === "signup"
      ? '{"event":"signup","click_id":"CLICK_ID","user_id":"USER-42"}'
      : `{"event":"purchase","click_id":"CLICK_ID","amount":499,"currency":"${currency}","order_id":"ORDER-1001"}`;
  return [
    `curl -X POST ${origin}/api/v1/events \\`,
    `  -H "Authorization: Bearer ${secretKey}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '${payload}'`,
  ].join("\n");
}

export function saveClickIdSnippet(): string {
  return [
    "// Node.js / Express example. Any language works the same way.",
    "const clickId = req.cookies.lt_id;          // set by the Linkto snippet",
    "await db.orders.update(orderId, { linktoClickId: clickId ?? null });",
    "",
    "// Later, in your payment webhook:",
    "// if (order.linktoClickId) -> send the purchase below with that click_id",
  ].join("\n");
}

function shopifyPixel({ origin, siteKey }: SnippetContext): string {
  return [
    'analytics.subscribe("checkout_completed", async (event) => {',
    '  const clickId = await browser.cookie.get("lt_id");',
    "  if (!clickId) return;",
    "  const checkout = event.data.checkout;",
    `  fetch("${origin}/api/v1/events", {`,
    '    method: "POST",',
    '    headers: { "Content-Type": "text/plain" },',
    "    keepalive: true,",
    "    body: JSON.stringify({",
    `      site: "${siteKey}",`,
    '      event: "purchase",',
    "      click_id: clickId,",
    "      amount: checkout.totalPrice.amount,",
    "      currency: checkout.currencyCode,",
    "      order_id: checkout.order ? checkout.order.id : undefined,",
    "    }),",
    "  });",
    "});",
  ].join("\n");
}

function wooCommerceSnippet({ origin, siteKey }: SnippetContext): string {
  return [
    "// Linkto tracking: loads on every page",
    "add_action('wp_head', function () { ?>",
    `<script>${STUB}</script>`,
    `<script async src="${origin}/t.js" data-site="${siteKey}"></script>`,
    "<?php });",
    "",
    "// Linkto tracking: reports each paid order",
    "add_action('woocommerce_thankyou', function ($order_id) {",
    "  $order = wc_get_order($order_id);",
    "  if (!$order) return; ?>",
    "<script>",
    '  linkto("purchase", {',
    "    amount: <?php echo (float) $order->get_total(); ?>,",
    '    currency: "<?php echo esc_js($order->get_currency()); ?>",',
    '    orderId: "<?php echo esc_js($order->get_order_number()); ?>"',
    "  });",
    "</script>",
    "<?php });",
  ].join("\n");
}

function gtmPurchaseTag({ currency = "INR" }: SnippetContext): string {
  return [
    "<script>",
    '  linkto("purchase", {',
    "    amount: {{Order Total}},",
    `    currency: "${currency}",`,
    '    orderId: "{{Order ID}}"',
    "  });",
    "</script>",
  ].join("\n");
}

export function integrationPlatforms(ctx: SnippetContext): IntegrationPlatform[] {
  const purchase = purchaseSnippet(ctx);
  return [
    {
      id: "website",
      label: "Any website",
      summary: "For custom sites, Webflow, Wix, Squarespace, Framer and anything else that lets you add code.",
      steps: [
        {
          title: "Paste this on every page",
          body: "Put it just before </head> in your site's main template or “custom code” setting, so it loads on every page.",
          code: baseSnippet(ctx),
          note: "Visits from Linkto links are now counted automatically.",
        },
        {
          title: "Paste this where a signup succeeds",
          body: "Add it to the page people see right after creating an account (your “welcome” or “thank you” page).",
          code: signupSnippet(),
          note: "No signups on your site? Skip this step.",
        },
        {
          title: "Paste this where a payment succeeds",
          body: "Add it to your order confirmation page. Replace 499 and ORDER-1001 with the real order amount and order number.",
          code: purchase,
          note: "The order number stops the same sale being counted twice if the page is refreshed. If payouts depend on purchase numbers, send purchases from your server instead (see “Server (verified)”): a browser call can be faked by the visitor.",
        },
      ],
    },
    {
      id: "shopify",
      label: "Shopify",
      summary: "Two pastes: one in your theme for visits, one in Customer events for orders.",
      steps: [
        {
          title: "Paste this in your theme",
          body: "Shopify admin → Online Store → Themes → ⋯ → Edit code → open theme.liquid → paste just before </head> → Save.",
          code: baseSnippet(ctx),
          note: "Visits from Linkto links are now counted automatically.",
        },
        {
          title: "Paste this in Customer events",
          body: "Shopify admin → Settings → Customer events → Add custom pixel → name it “Linkto” → replace the sample code with this → Save → Connect.",
          code: shopifyPixel(ctx),
          note: "Every completed checkout is reported with its real total, currency and order ID. Nothing to edit.",
        },
      ],
    },
    {
      id: "woocommerce",
      label: "WordPress / WooCommerce",
      summary: "One paste covers visits and paid orders.",
      steps: [
        {
          title: "Paste this once",
          body: "Install the free “Code Snippets” plugin → Snippets → Add New → paste this → choose “Run everywhere” → Activate. (Or add it to your child theme's functions.php.)",
          code: wooCommerceSnippet(ctx),
          note: "Order totals, currency and order numbers are filled in automatically. Nothing to edit.",
        },
      ],
    },
    {
      id: "gtm",
      label: "Google Tag Manager",
      summary: "Two Custom HTML tags: one on all pages, one on your purchase trigger.",
      steps: [
        {
          title: "Tag 1: all pages",
          body: "Tags → New → Custom HTML → paste this → Trigger: All Pages → Save.",
          code: baseSnippet(ctx),
        },
        {
          title: "Tag 2: purchases",
          body: "Tags → New → Custom HTML → paste this → Trigger: your existing purchase / order-complete trigger. {{Order Total}} and {{Order ID}} are GTM variables: point them at your data layer's order total and order ID.",
          code: gtmPurchaseTag(ctx),
        },
        {
          title: "Tag 3: signups (optional)",
          body: "Tags → New → Custom HTML → paste this → Trigger: your signup trigger. Then Submit to publish all three.",
          code: signupSnippet(),
        },
      ],
    },
    {
      id: "server",
      label: "Server (verified)",
      summary:
        "The reliable way to report purchases: your server tells Linkto, using a secret key nobody else has. Use it when payouts or invoices depend on the numbers, for mobile apps, and for payment webhooks. Ad blockers cannot stop it and visitors cannot fake it.",
      steps: [
        {
          title: "Keep the website snippet for visits",
          body: "Add the “Any website” step 1 snippet as usual. It counts visits and saves the click ID in a cookie called lt_id, which your server can read on any request. In a mobile app, read lt_id from the link that opened the app and send it to your server.",
          code: baseSnippet(ctx),
        },
        {
          title: "Save the click ID when the customer signs up or checks out",
          body: "Read the lt_id cookie on your server and store it with the user or the order, so it is still there when the payment is confirmed later.",
          code: saveClickIdSnippet(),
        },
        {
          title: "Send the purchase when the payment is confirmed",
          body: "Call this from your payment provider's webhook or success handler. Send the real amount, currency and order number.",
          code: serverSnippet(ctx, "purchase"),
          note: "Keep the secret key on your server, in an environment variable. Never put it in a web page or app.",
        },
        {
          title: "Send signups the same way (optional)",
          body: "Include user_id. Later purchases can then be sent with just that user_id, without a click ID.",
          code: serverSnippet(ctx, "signup"),
        },
        {
          title: "Turn on “Only count purchases sent from the server”",
          body: "In Linkto → Conversion tracking → this website → Verified purchases. From then on Linkto ignores any purchase that does not carry your secret key, so the numbers cannot be inflated from a browser.",
        },
      ],
    },
  ];
}

/** URL that opens the brand's site in test mode (nothing is stored). */
export function testModeUrl(domain: string | null | undefined): string | null {
  const raw = (domain ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    url.searchParams.set("lt_id", "lt_test_setup");
    return url.toString();
  } catch {
    return null;
  }
}
