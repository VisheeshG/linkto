# Link Tracking System

A comprehensive link tracking platform built with Next.js and Supabase that enables brands to track campaign performance, creator engagement, and detailed traffic analytics.


## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd my-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Copy `.env.example` to `.env.local` and fill it in:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   IP_API_KEY=                     # recommended in production (ip-api.com Pro)
   PROJECT_ACCESS_SECRET=          # recommended: random secret
   VISITOR_HASH_SALT=              # recommended: random secret
   NEXT_PUBLIC_ANALYTICS_TIME_ZONE=Asia/Kolkata
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is **required**: tracking redirects record
   clicks with it, and shared project pages, password checks and project
   deletion use it. Find it in Supabase Dashboard → Project Settings → API.
   It is only used server-side.

4. **Run database migrations**
   Apply every file in `supabase/migrations/` in filename order (for example
   with `supabase db push`). A fresh database can be built from them.

   After applying `20261025000000_bot_filtering_and_security.sql` to an
   existing database, classify historical clicks (adds datacenter detection
   and unique-visitor hashes):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
   VISITOR_HASH_SALT=<same as production> npm run backfill:bots -- --dry-run
   # then run again without --dry-run
   ```

5. **Run the dev server**

   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Bot & datacenter filtering

Every click is classified when it is recorded (`link_clicks.traffic_type`):

| Type | Meaning |
| --- | --- |
| `human` | A real browser on a home / mobile network |
| `bot` | Link-preview fetchers (WhatsApp, Facebook/Meta, X, LinkedIn, Slack, Telegram, …), search / AI crawlers, scanners, HTTP libraries, headless browsers, `HEAD` requests |
| `datacenter` | Requests from cloud / hosting networks (Google, AWS, Azure, Meta, DigitalOcean, …) based on the IP's ASN and the geolocation provider's hosting flag |
| `suspicious` | Browser-like requests missing headers every browser sends, or bursts of repeated clicks from the same visitor |

Analytics pages have a **Hide bot clicks** switch (on by default, remembered
per browser) that shows only `human` clicks everywhere: link and brand
analytics, shared project pages and dashboard totals. The **Details** panel
shows how many clicks were hidden and why. Rules live in
`lib/bot-detection.ts`.

## Development

```bash
npm run lint
npm run typecheck
npm test          # vitest unit tests in tests/
npm run build
```

CI runs all four on every pull request.

## Public tracking URLs

**Branded projects** (recommended):

```text
linkto.in/{brandSlug}/{projectSlug}/{shortCode}/{creator}
linkto.in/{brandSlug}/{projectSlug}/{shortCode}/{creator}/sub1   ← if “Include submission in URL” is enabled on the link
```

**Legacy / unbranded projects:**

```text
linkto.in/{projectSlug}/{shortCode}/{creator}
linkto.in/{projectSlug}/{shortCode}/{creator}/sub1
```

Example: `linkto.in/fws/podcast-1/ytrst/vish`
