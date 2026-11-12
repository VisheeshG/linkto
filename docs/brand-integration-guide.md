# Linkto integration guide for brands

Track the visits, signups and purchases that creators send you. About 10 minutes:
copy, paste, test. You do **not** need referral codes, coupons or an affiliate system.

The same guide, with your key filled into every code sample, is online at
**https://linkto.in/guide**.

## Before you start

You need your **site key**. It starts with `lt_pub_`. The person who invited you to
Linkto can send it (Linkto → Conversion tracking → your website → Keys), or send you a
guide link that already contains it.

In the code below, replace `YOUR_SITE_KEY` with it.

## Pick your platform

| Your site runs on | Go to |
| --- | --- |
| Anything where you can add code (custom site, Webflow, Wix, Squarespace, Framer) | [Any website](#any-website) |
| Shopify | [Shopify](#shopify) |
| WordPress with WooCommerce | [WooCommerce](#wordpress--woocommerce) |
| Google Tag Manager | [Google Tag Manager](#google-tag-manager) |
| A mobile app, or you want your server to report sales | [Server or mobile app](#server-or-mobile-app) |

---

## Any website

### Step 1. Paste this on every page

Put it just before `</head>` in your site's main template (or its "custom code" /
"header code" setting), so it loads on every page.

```html
<!-- Linkto tracking -->
<script>window.linkto=window.linkto||function(){(linkto.q=linkto.q||[]).push(arguments)};</script>
<script async src="https://linkto.in/t.js" data-site="YOUR_SITE_KEY"></script>
```

Visits from Linkto links are now counted automatically.

### Step 2. Paste this where a signup succeeds

Add it to the page people see right after creating an account (your "welcome" or
"thank you" page). No signups on your site? Skip this step.

```html
<script>
  linkto("signup");
</script>
```

### Step 3. Paste this where a payment succeeds

Add it to your order confirmation page. Replace `499` and `ORDER-1001` with the real
order amount and order number.

```html
<script>
  linkto("purchase", {
    amount: 499,          // what the customer paid
    currency: "INR",
    orderId: "ORDER-1001" // your order number
  });
</script>
```

The order number stops the same sale being counted twice if the page is refreshed.

---

## Shopify

### Step 1. Paste this in your theme

Shopify admin → **Online Store** → **Themes** → **⋯** → **Edit code** → open
`theme.liquid` → paste just before `</head>` → **Save**.

```html
<!-- Linkto tracking -->
<script>window.linkto=window.linkto||function(){(linkto.q=linkto.q||[]).push(arguments)};</script>
<script async src="https://linkto.in/t.js" data-site="YOUR_SITE_KEY"></script>
```

### Step 2. Paste this in Customer events

Shopify admin → **Settings** → **Customer events** → **Add custom pixel** → name it
"Linkto" → replace the sample code with this → **Save** → **Connect**.

```js
analytics.subscribe("checkout_completed", async (event) => {
  const clickId = await browser.cookie.get("lt_id");
  if (!clickId) return;
  const checkout = event.data.checkout;
  fetch("https://linkto.in/api/v1/events", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    keepalive: true,
    body: JSON.stringify({
      site: "YOUR_SITE_KEY",
      event: "purchase",
      click_id: clickId,
      amount: checkout.totalPrice.amount,
      currency: checkout.currencyCode,
      order_id: checkout.order ? checkout.order.id : undefined,
    }),
  });
});
```

Every completed checkout is reported with its real total, currency and order ID.
Nothing to edit except the site key.

---

## WordPress / WooCommerce

Install the free **Code Snippets** plugin → **Snippets** → **Add New** → paste this →
choose **Run everywhere** → **Activate**. (Or add it to your child theme's
`functions.php`.)

```php
// Linkto tracking: loads on every page
add_action('wp_head', function () { ?>
<script>window.linkto=window.linkto||function(){(linkto.q=linkto.q||[]).push(arguments)};</script>
<script async src="https://linkto.in/t.js" data-site="YOUR_SITE_KEY"></script>
<?php });

// Linkto tracking: reports each paid order
add_action('woocommerce_thankyou', function ($order_id) {
  $order = wc_get_order($order_id);
  if (!$order) return; ?>
<script>
  linkto("purchase", {
    amount: <?php echo (float) $order->get_total(); ?>,
    currency: "<?php echo esc_js($order->get_currency()); ?>",
    orderId: "<?php echo esc_js($order->get_order_number()); ?>"
  });
</script>
<?php });
```

Order totals, currency and order numbers are filled in automatically.

---

## Google Tag Manager

1. **Tag 1, all pages.** Tags → New → Custom HTML → paste the Step 1 snippet from
   [Any website](#any-website) → Trigger: **All Pages** → Save.
2. **Tag 2, purchases.** Tags → New → Custom HTML → paste this → Trigger: your existing
   purchase / order-complete trigger. `{{Order Total}}` and `{{Order ID}}` are GTM
   variables: point them at your data layer's order total and order ID.

   ```html
   <script>
     linkto("purchase", {
       amount: {{Order Total}},
       currency: "INR",
       orderId: "{{Order ID}}"
     });
   </script>
   ```
3. **Tag 3, signups (optional).** Custom HTML with `<script>linkto("signup");</script>`
   on your signup trigger.
4. **Submit** to publish.

---

## Server or mobile app

Use this for mobile apps, payment webhooks, or when you want events that ad blockers
cannot stop. It needs your **secret key** (starts with `lt_sec_`), shown once when the
website was added in Linkto. Keep it on your server; never put it in a web page or app.

**1. Get the click ID.**

- Website: add the Step 1 snippet from [Any website](#any-website). Your server can then
  read the `lt_id` cookie from any request.
- Mobile app: read `lt_id` from the link that opened the app and send it to your server.

**2. Send a signup** when an account is created. Include `user_id` so later purchases
can be matched to this person even without a click ID.

```bash
curl -X POST https://linkto.in/api/v1/events \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"signup","click_id":"CLICK_ID","user_id":"USER-42"}'
```

**3. Send a purchase** when a payment succeeds. Send `click_id`, or just the same
`user_id` you sent at signup.

```bash
curl -X POST https://linkto.in/api/v1/events \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"purchase","user_id":"USER-42","amount":499,"currency":"INR","order_id":"ORDER-1001"}'
```

A reply of `{"ok":true,"status":"recorded"}` means it was counted.
`"status":"duplicate"` means it was already counted (safe to retry).

---

## Test it

1. Open any page of your site with `?lt_id=lt_test_setup` added to the address, for
   example `https://www.yoursite.com/?lt_id=lt_test_setup`.
2. A green badge appears in the bottom-left corner: **"Linkto test mode: visit received ✓"**.
   The snippet is installed correctly.
3. In the same browser tab, sign up and place a test order. The badge shows
   **"signup received ✓"** and **"purchase received ✓"**.
4. Done. Test events are never counted in reports. In Linkto → Conversion tracking, the
   checklist for your site shows the same three ticks.

**No badge?** The snippet is not on that page, or the site key in it is wrong. Check
Step 1 and reload.

## Common questions

**Do I need my own referral or coupon system?** No. Linkto tags each click, and the
snippet reports what that visitor did.

**Will it slow my website down?** No. The script is under 3 KB, loads in the
background, and only contacts Linkto when a visitor arrived through a Linkto link.

**What information does it collect?** The click ID, the event name and, for purchases,
the amount, currency and your order number. No names, emails, phone numbers or card
details.

**Does it use cookies?** One first-party cookie on your own domain, `lt_id`, kept for
30 days. It holds the click ID and nothing else. If your site has a cookie banner, list
it under analytics or marketing.

**How long after a click does a purchase still count?** 30 days. If the same person
clicks two creators' links, the most recent click gets the credit.

**What if a visitor uses an ad blocker?** Some ad blockers stop tracking scripts. If you
need every sale counted, use [Server or mobile app](#server-or-mobile-app).

**Can the same order be counted twice?** Not if you pass your order number. Each order
number is counted once, even if both the page and your server report it.

**Can I track other actions?** Yes: `linkto("track", "add_to_cart")` records a custom
event with any name you choose.
