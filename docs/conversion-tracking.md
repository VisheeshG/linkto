# Conversion tracking

How Linkto follows a click through to the visit, signup and purchase, how to turn it
on, how to test it, and where the code lives.

Brand-facing, copy-paste instructions are in
[brand-integration-guide.md](brand-integration-guide.md) and online at `/guide`.

## The idea

```text
creator link ──▶ Linkto redirect ──▶ brand site ──▶ signup ──▶ purchase
                  │ records the click   │ t.js stores lt_id,     │
                  │ adds ?lt_id=…       │ reports each event     │
                  ▼                     ▼                        ▼
              link_clicks  ◀──── matched by click ID ──── conversion_events
```

1. **Every click gets an ID.** The redirect generates an unguessable click ID, stores it
   on the click, and appends it to the destination URL as `lt_id`.
2. **The brand's site reports what happened.** A pasted snippet (`/t.js`) keeps the click
   ID in a first-party cookie and calls `POST /api/v1/events` for the visit, the signup
   and the purchase. A server can call the same endpoint with a secret key.
3. **Linkto matches the event to the click**, and so to the creator, link and campaign.
4. **Reports** show clicks → visits → signups → purchases and revenue per creator.

The brand needs no referral codes, coupons or affiliate software.

## Turning it on

1. **Apply the migration** `supabase/migrations/20261112000000_conversion_tracking.sql`
   (for example `supabase db push`). It is safe to run more than once.
2. **Deploy the app.** No new environment variables. The code tolerates being deployed
   before the migration: redirects keep working, click IDs are simply not handed out, and
   the Integration page tells you the migration is missing.
3. **Add a website:** Dashboard → **Conversion tracking** → **Add website**. Copy the
   snippet, or use **Copy guide link for the developer** to send the brand a guide with
   their key already filled in.
4. **Test it** (below).

New and existing links append `lt_id` by default. To switch it off for one link (for a
destination that rejects unknown URL parameters), edit the link → Advanced options →
untick **Track signups and purchases**. Links that open a native app on phones never
get an `lt_id` on those opens.

## Testing

### In two minutes, without touching a real site

1. In **Conversion tracking**, add a website and note the site key.
2. Click any of your tracking links in a browser. The address you land on ends with
   `lt_id=…`. Copy that value.
3. Report a purchase for it (replace the three placeholders):

   ```bash
   curl -X POST https://YOUR-LINKTO-DOMAIN/api/v1/events \
     -H "Content-Type: text/plain" \
     -d '{"site":"YOUR_SITE_KEY","event":"purchase","click_id":"THE_LT_ID","amount":499,"order_id":"TEST-1"}'
   ```

   The reply is `{"ok":true,"status":"recorded",…}`.
4. Open the link's analytics → **Conversions**. The creator you clicked as shows one
   purchase and ₹499.

### On the brand's real site

1. Install the snippet (see the guide).
2. In **Conversion tracking**, press **Open website in test mode**. It opens the site
   with `?lt_id=lt_test_setup`.
3. A green badge appears on the site for each step (visit, signup, purchase), and the
   checklist on the Integration page ticks itself. Test events are never stored.
4. Then click a real tracking link, complete a signup or purchase, and check the
   **Conversions** tab.

### Automated tests

```bash
npm test          # includes tests/conversion-tracking.test.ts
```

Covers click IDs, event validation, funnel maths, the link cache, the integration
snippets, and the browser snippet (`public/t.js`, run against a fake browser).

## Where results appear

| Screen | What it shows |
| --- | --- |
| Link analytics → **Conversions** tab | Funnel and per-creator table for one link, for the selected date range |
| Project page → **Conversions** | The same for every link in the campaign (all time) |
| Brand page → Analytics → **Conversions** | The same across the brand's campaigns |
| Shared report | "After the click" section, once the first event has arrived |
| **Conversion tracking** (`/dashboard/integration`) | Websites, snippets, test checklist, keys |

## Events API

`POST /api/v1/events`

| Caller | How it identifies itself | Notes |
| --- | --- | --- |
| Browser snippet | `"site": "lt_pub_…"` in the body | Sent as `text/plain` (no CORS preflight). Must include `click_id`. |
| Server | `Authorization: Bearer lt_sec_…` | Trusted. May send `user_id` instead of `click_id`. |

Body fields (camelCase is accepted too):

| Field | Required | Meaning |
| --- | --- | --- |
| `event` | yes | `visit`, `signup`, `purchase`, or a custom name (`add_to_cart`) |
| `click_id` | browser: yes; server: this or `user_id` | The `lt_id` value |
| `user_id` | no | Your customer ID. Sent with a signup, it lets later server events be matched by `user_id` alone |
| `amount` | no (purchases) | Number, e.g. `499` or `499.50` |
| `currency` | no | 3-letter code. Defaults to the website's currency |
| `order_id` | recommended | Your order number; makes the purchase count exactly once |
| `event_id` | no | For custom events that may happen more than once per click |

Responses:

| Status | `status` | Meaning |
| --- | --- | --- |
| 200 | `recorded` | Stored and credited |
| 200 | `duplicate` | Already stored; safe to ignore |
| 200 | `test` | Test click; checklist updated, nothing stored |
| 202 | `pending` | Browser visit arrived before the click was saved; retried automatically |
| 400 | — | Invalid body (the `error` says what) |
| 401 | — | Unknown site key or secret key |
| 403 | `forbidden` | The click belongs to another Linkto account |
| 404 | `unknown_click` | No click (or earlier event for that `user_id`) to credit |
| 410 | `expired` | Click is older than the attribution window |

## Rules

- **Attribution window:** 30 days from the click (`ATTRIBUTION_WINDOW_DAYS` in
  `lib/conversion-events.ts`; the cookie lifetime in `public/t.js` matches).
- **Last click wins:** a newer `lt_id` replaces the stored one.
- **Counted once:**
  - visit: once per click
  - signup: once per `user_id`, or once per click when no `user_id` is sent
  - purchase: once per `order_id`; without one, once per click + amount + currency per day
  - custom event: once per click + name, or once per `event_id`
- **Bots:** events are accepted for any click; the funnel's click count follows the
  "Hide bots" switch.

## Data model

Added by `20261112000000_conversion_tracking.sql`:

| Object | Purpose |
| --- | --- |
| `link_clicks.click_id` | The ID appended as `lt_id` (unique) |
| `links.click_id_enabled` | Per-link switch, on by default |
| `tracking_sites` | One row per brand website: public key, SHA-256 hash of the secret key, test checklist timestamps |
| `conversion_events` | One row per credited event, denormalised with owner, project, link and creator |
| `record_conversion_event()` | Attributes and stores one event in a single round trip (service role only) |
| `create_tracking_site()`, `rotate_tracking_site_secret()` | Create a site / replace its secret; the secret is returned once and never stored |
| `conversion_summary()`, `click_counts_per_creator()`, `click_counts_per_link()` | Grouped counts for reports |

Access: owners can read their own sites and events (row level security). Events are
written only by the service role through the API. Shared reports get grouped counts
only, never individual events, customer IDs or order IDs.

## Speed and scale

- **Redirects:** link lookups are cached in memory for 30 seconds per server instance
  (10 seconds for "not found"), so a busy link costs the database one lookup per
  instance every 30 seconds instead of two or three per click. An edit to a link can
  therefore take up to 30 seconds to reach redirects.
- **Events:** one database round trip per event; site keys are cached for 60 seconds.
- **Reports:** conversion reports and per-link click counts are grouped in the
  database, so the browser receives at most one row per creator and event type.
- **Snippet:** `/t.js` is under 3 KB gzipped, cached for an hour, loads `async`, and
  makes no request for visitors who did not arrive through a Linkto link.

## Limits to know about

- **Something must be installed.** Without the snippet or server calls, Linkto still
  sees clicks only.
- **Ad blockers and Safari.** Some blockers stop the snippet, and Safari caps
  script-set cookies at 7 days, so browser-only tracking undercounts a little. The
  server API avoids both.
- **Browser events are not proof.** Like any tracking pixel, a visitor can forge an
  event for their own click. Use the server API (secret key) where payouts depend on
  the numbers.
- **No rate limiting** on the events endpoint yet beyond the de-duplication rules.
- **Click breakdowns** (cities, devices, the map) still load raw click rows in the
  browser; only conversion reports and per-link counts are grouped in the database.
- **Exports** (PDF / Excel) do not include conversions yet.

## Code map

| File | What it does |
| --- | --- |
| `lib/click-id.ts` | Generate / validate click IDs, append `lt_id` |
| `lib/tracking-redirect.ts` | Redirect handler: issues the click ID and records it |
| `lib/link-resolution.ts` | Link lookup and its 30-second cache |
| `public/t.js` | Browser snippet |
| `app/api/v1/events/route.ts` | Events endpoint |
| `lib/conversion-events.ts` | Event validation and statuses |
| `lib/tracking-sites.ts` | Key lookup (cached) |
| `lib/conversions.ts`, `lib/conversion-source.ts` | Funnel maths and data loading |
| `components/analytics/ConversionsPanel.tsx` | Funnel + per-creator table |
| `components/integration/*`, `app/dashboard/integration` | Integration page |
| `lib/integration-snippets.ts` | Copy-paste code for every platform |
| `app/guide`, `components/guide` | Public integration guide |
| `components/landing/HowItWorksPlayer.tsx`, `app/how-it-works` | Animated explainer |
