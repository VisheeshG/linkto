"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  KeyRound,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { AppPage } from "@/components/app/AppPage";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  Dialog,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Skeleton,
  buttonClasses,
} from "@/components/ui";
import { supabase, type TrackingSite } from "@/lib/supabase";
import { describeError } from "@/lib/describe-error";
import { formatRelative } from "@/lib/format";
import {
  PLACEHOLDER_SECRET_KEY,
  integrationPlatforms,
  testModeUrl,
} from "@/lib/integration-snippets";
import { PlatformSteps } from "./PlatformSteps";

const SITE_COLUMNS =
  "id, user_id, name, domain, default_currency, public_key, secret_key_hint, last_event_at, test_visit_at, test_signup_at, test_purchase_at, created_at, updated_at";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

/** How long the page keeps checking for test events after "Open in test mode". */
const TEST_WATCH_MS = 5 * 60 * 1000;
const TEST_POLL_MS = 3000;

function isMissingSchema(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    /schema cache|does not exist/i.test(error.message ?? "")
  );
}

export function IntegrationPage() {
  const [sites, setSites] = useState<TrackingSite[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [revealed, setRevealed] = useState<{ siteName: string; secret: string } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadSites = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("tracking_sites")
      .select(SITE_COLUMNS)
      .order("created_at", { ascending: true });
    if (error) {
      if (isMissingSchema(error)) setNotInstalled(true);
      else setLoadError(describeError(error));
      return;
    }
    setSites((data as TrackingSite[]) ?? []);
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const createSite = async (values: { name: string; domain: string; currency: string }) => {
    const { data, error } = await supabase.rpc("create_tracking_site", {
      p_name: values.name,
      p_domain: values.domain || null,
      p_default_currency: values.currency,
    });
    const created = (data as { id: string; public_key: string; secret_key: string }[] | null)?.[0];
    if (error || !created) {
      toast.error(`Couldn't add the website: ${describeError(error ?? "no response")}`);
      return false;
    }
    await loadSites();
    setRevealed({ siteName: values.name, secret: created.secret_key });
    return true;
  };

  const crumbs = [{ label: "Dashboard", href: "/dashboard" }, { label: "Conversion tracking" }];

  return (
    <AppPage crumbs={crumbs}>
      <PageHeader
        title="Conversion tracking"
        description="See the visits, signups and purchases your creators drive. Add a website, paste one snippet, done."
        actions={
          <>
            <Link href="/guide" target="_blank" className={buttonClasses({ variant: "secondary" })}>
              <BookOpen className="h-[18px] w-[18px]" aria-hidden />
              <span>Guide</span>
            </Link>
            {!notInstalled && (
              <Button icon={Plus} onClick={() => setShowNew(true)}>
                Add website
              </Button>
            )}
          </>
        }
      />

      {notInstalled ? (
        <ErrorState
          title="Conversion tracking isn't enabled on this database yet"
          message="Apply supabase/migrations/20261112000000_conversion_tracking.sql (for example with `supabase db push`), then reload this page."
          onRetry={() => {
            setNotInstalled(false);
            loadSites();
          }}
        />
      ) : loadError ? (
        <ErrorState title="Couldn't load your websites" message={loadError} onRetry={loadSites} />
      ) : sites === null ? (
        <LoadingBlock label="Loading websites">
          <Skeleton className="h-64" />
        </LoadingBlock>
      ) : sites.length === 0 ? (
        <div className="space-y-6">
          <HowItWorks />
          <EmptyState
            icon={Target}
            title="Add the first website"
            description="One entry per brand website or app. You get a snippet to copy and paste; no referral codes or coupon system needed."
            action={
              <Button icon={Plus} onClick={() => setShowNew(true)}>
                Add website
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              origin={origin}
              defaultOpen={sites.length === 1 || !site.last_event_at}
              onChanged={loadSites}
              onSecretRotated={(secret) => setRevealed({ siteName: site.name, secret })}
            />
          ))}
        </div>
      )}

      <NewSiteDialog open={showNew} onClose={() => setShowNew(false)} onSubmit={createSite} />
      <SecretDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </AppPage>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Every click gets an ID",
      body: "Linkto adds a small tag (lt_id) to the page a creator's link opens.",
    },
    {
      title: "The website reports what happened",
      body: "A pasted snippet tells Linkto when that visitor signs up or pays.",
    },
    {
      title: "You see results per creator",
      body: "Visits, signups, purchases and revenue, next to the clicks you already track.",
    },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      {steps.map((step, i) => (
        <li key={step.title}>
          <Card className="h-full">
            <span
              aria-hidden
              className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700"
            >
              {i + 1}
            </span>
            <h2 className="text-base font-semibold text-slate-900">{step.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{step.body}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

function SiteCard({
  site: initialSite,
  origin,
  defaultOpen,
  onChanged,
  onSecretRotated,
}: {
  site: TrackingSite;
  origin: string;
  defaultOpen: boolean;
  onChanged: () => Promise<void>;
  onSecretRotated: (secret: string) => void;
}) {
  const [site, setSite] = useState(initialSite);
  const [open, setOpen] = useState(defaultOpen);
  const [watchingUntil, setWatchingUntil] = useState(0);
  const [confirm, setConfirm] = useState<"delete" | "rotate" | null>(null);
  const watching = watchingUntil > Date.now();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setSite(initialSite), [initialSite]);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("tracking_sites")
      .select(SITE_COLUMNS)
      .eq("id", initialSite.id)
      .maybeSingle();
    if (data) setSite(data as TrackingSite);
  }, [initialSite.id]);

  // After "Open in test mode", poll so the checklist ticks by itself.
  useEffect(() => {
    if (!watchingUntil) return;
    timer.current = setInterval(() => {
      if (Date.now() > watchingUntil) {
        setWatchingUntil(0);
        return;
      }
      refresh();
    }, TEST_POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [watchingUntil, refresh]);

  const platforms = useMemo(
    () =>
      integrationPlatforms({
        origin,
        siteKey: site.public_key,
        secretKey: PLACEHOLDER_SECRET_KEY,
        currency: site.default_currency,
      }),
    [origin, site.public_key, site.default_currency]
  );

  const testUrl = testModeUrl(site.domain);
  const panelId = `site-${site.id}-setup`;

  const deleteSite = async () => {
    const { error } = await supabase.from("tracking_sites").delete().eq("id", site.id);
    if (error) {
      toast.error(`Couldn't remove the website: ${describeError(error)}`);
      return;
    }
    toast.success("Website removed");
    await onChanged();
  };

  const rotateSecret = async () => {
    const { data, error } = await supabase.rpc("rotate_tracking_site_secret", {
      p_site_id: site.id,
    });
    if (error || typeof data !== "string") {
      toast.error(`Couldn't create a new key: ${describeError(error ?? "no response")}`);
      return;
    }
    await onChanged();
    onSecretRotated(data);
  };

  const checks = [
    { label: "Snippet installed (visit received)", at: site.test_visit_at },
    { label: "Signup received", at: site.test_signup_at },
    { label: "Purchase received", at: site.test_purchase_at },
  ];

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-900">{site.name}</h2>
            {site.last_event_at ? (
              <Badge tone="success">Receiving events</Badge>
            ) : site.test_visit_at ? (
              <Badge tone="info">Tested, waiting for real traffic</Badge>
            ) : (
              <Badge tone="warning">Not installed yet</Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-600">
            {site.domain || "No website address"}
            {site.last_event_at && <> · last event {formatRelative(site.last_event_at)}</>}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          {open ? "Hide setup" : "Show setup"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </Button>
        <DropdownMenu
          label={`More actions for ${site.name}`}
          align="end"
          items={[
            {
              label: "New secret key",
              description: "For the server API. The old key stops working.",
              icon: KeyRound,
              onSelect: () => setConfirm("rotate"),
            },
            {
              label: "Remove website",
              icon: Trash2,
              tone: "danger",
              onSelect: () => setConfirm("delete"),
            },
          ]}
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label={`More actions for ${site.name}`}
              className={buttonClasses({ variant: "ghost", iconOnly: true })}
            >
              <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
        />
      </div>

      {open && (
        <div id={panelId} className="space-y-6 border-t border-slate-200 p-4 sm:p-5">
          <section aria-labelledby={`${panelId}-install`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 id={`${panelId}-install`} className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                1. Install
              </h3>
              {origin && (
                <CopyButton
                  text={`${origin}/guide?key=${site.public_key}`}
                  label="Copy guide link for the developer"
                  copiedLabel="Link copied"
                />
              )}
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Doing it yourself? Follow the steps below. Someone else manages the website? Send
              them the guide link: it opens the same steps with this site&apos;s key already filled in.
            </p>
            {origin && <PlatformSteps platforms={platforms} idPrefix={`site-${site.id}`} />}
          </section>

          <section aria-labelledby={`${panelId}-test`} className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
            <h3 id={`${panelId}-test`} className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              2. Test it
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Open the website in test mode, then do a signup and a purchase like a customer would.
              A green badge appears on the site for each step, and the list below ticks itself.
              Test events are never counted in reports.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {testUrl ? (
                <a
                  href={testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWatchingUntil(Date.now() + TEST_WATCH_MS)}
                  className={buttonClasses({ variant: "primary" })}
                >
                  <ExternalLink className="h-[18px] w-[18px]" aria-hidden />
                  <span>Open website in test mode</span>
                </a>
              ) : (
                <p className="text-sm text-slate-700">
                  Add <span className="font-mono text-xs">?lt_id=lt_test_setup</span> to any page address on the website to start test mode.
                </p>
              )}
              <Button variant="secondary" onClick={refresh}>
                Check now
              </Button>
              {watching && (
                <span role="status" className="text-sm text-slate-600">
                  Waiting for test events…
                </span>
              )}
            </div>
            <ul className="mt-4 space-y-2">
              {checks.map((check) => (
                <li key={check.label} className="flex items-center gap-2 text-sm">
                  {check.at ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  )}
                  <span className={check.at ? "font-medium text-slate-900" : "text-slate-700"}>
                    {check.label}
                  </span>
                  <span className="text-slate-600">
                    {check.at ? `· ${formatRelative(check.at)}` : "· not yet"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${panelId}-keys`}>
            <h3 id={`${panelId}-keys`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
              Keys
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="w-24 shrink-0 text-slate-600">Site key</dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <code className="truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">
                    {site.public_key}
                  </code>
                  <CopyButton text={site.public_key} label="Copy site key" iconOnly />
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="w-24 shrink-0 text-slate-600">Secret key</dt>
                <dd className="text-slate-700">
                  <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">
                    lt_sec_••••{site.secret_key_hint}
                  </code>{" "}
                  <span className="text-slate-600">
                    Shown once when created. Lost it? Use “New secret key” in the ⋯ menu.
                  </span>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={deleteSite}
        title={`Remove ${site.name}?`}
        description="Its keys stop working immediately, so the website can no longer report signups or purchases. Events already recorded stay in your reports."
        confirmLabel="Remove website"
      />
      <ConfirmDialog
        open={confirm === "rotate"}
        onClose={() => setConfirm(null)}
        onConfirm={rotateSecret}
        title="Create a new secret key?"
        description="The current secret key stops working immediately. Any server using it must be updated with the new key. The snippet on the website is not affected."
        confirmLabel="Create new key"
        tone="primary"
      />
    </Card>
  );
}

function NewSiteDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; domain: string; currency: string }) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [errors, setErrors] = useState<{ name?: string; domain?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDomain("");
    setCurrency("INR");
    setErrors({});
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter a name, for example the brand's name.";
    if (domain.trim() && !testModeUrl(domain)) {
      next.domain = "That doesn't look like a website address. Example: https://www.brand.com";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      if (await onSubmit({ name: name.trim(), domain: domain.trim(), currency })) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title="Add website"
      description="One entry per brand website or app that should report signups and purchases."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="new-site-form" loading={submitting}>
            Add website
          </Button>
        </>
      }
    >
      <form id="new-site-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Name" error={errors.name} hint="Only you see this.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme store" autoFocus />
        </Field>
        <Field
          label="Website address"
          optional
          error={errors.domain}
          hint="Used for the “Open website in test mode” button."
        >
          <Input
            type="url"
            inputMode="url"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://www.brand.com"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Currency" hint="Used when a purchase is reported without a currency.">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}

function SecretDialog({
  revealed,
  onClose,
}: {
  revealed: { siteName: string; secret: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={revealed !== null}
      onClose={onClose}
      title="Save this secret key"
      description={`For ${revealed?.siteName ?? "this website"}'s server API. It is shown only once.`}
      footer={<Button onClick={onClose}>I&apos;ve saved it</Button>}
    >
      {revealed && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-900">
              {revealed.secret}
            </code>
            <CopyButton text={revealed.secret} label="Copy" variant="primary" size="md" />
          </div>
          <p className="text-sm text-slate-600">
            Only needed for the “Server or mobile app” option. If you only paste the website
            snippet, you can ignore this key. Keep it private: never put it in a web page or app.
          </p>
        </div>
      )}
    </Dialog>
  );
}
