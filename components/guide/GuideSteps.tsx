"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, Input } from "@/components/ui";
import { PlatformSteps } from "@/components/integration/PlatformSteps";
import {
  PLACEHOLDER_SITE_KEY,
  integrationPlatforms,
} from "@/lib/integration-snippets";

const KEY_PATTERN = /^lt_pub_[0-9a-f]{16,64}$/;

/**
 * The copy-paste steps, with the reader's site key filled into every code
 * sample. The key comes from the link they were sent (?key=…) or the box.
 */
export function GuideSteps({ origin }: { origin: string }) {
  const [key, setKey] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key") ?? "";
    if (KEY_PATTERN.test(fromUrl)) setKey(fromUrl);
  }, []);

  const trimmed = key.trim();
  const valid = KEY_PATTERN.test(trimmed);
  const platforms = useMemo(
    () => integrationPlatforms({ origin, siteKey: valid ? trimmed : PLACEHOLDER_SITE_KEY }),
    [origin, trimmed, valid]
  );

  return (
    <div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Field
          label="Your site key"
          hint={
            valid ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Filled into every code sample below. Just copy and paste.
              </span>
            ) : (
              "Starts with lt_pub_. The person who invited you to Linkto can send it, or find it in Linkto → Conversion tracking."
            )
          }
          error={
            trimmed && !valid ? "That doesn't look like a site key. It starts with lt_pub_." : undefined
          }
        >
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="lt_pub_…"
            className="font-mono"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
      </div>
      <PlatformSteps platforms={platforms} idPrefix="guide" />
    </div>
  );
}
