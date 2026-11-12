"use client";

import { useState } from "react";
import { Tabs, TabPanel, type TabItem } from "@/components/ui";
import type { IntegrationPlatform } from "@/lib/integration-snippets";
import { CodeBlock } from "./CodeBlock";

/** Platform picker + numbered copy-paste steps for the chosen platform. */
export function PlatformSteps({
  platforms,
  idPrefix,
}: {
  platforms: IntegrationPlatform[];
  idPrefix: string;
}) {
  const [active, setActive] = useState<IntegrationPlatform["id"]>(platforms[0].id);
  const tabs: TabItem<IntegrationPlatform["id"]>[] = platforms.map((p) => ({
    id: p.id,
    label: p.label,
  }));

  return (
    <div>
      <Tabs
        tabs={tabs}
        value={active}
        onChange={setActive}
        idPrefix={idPrefix}
        label="Choose your platform"
        className="mb-4"
      />
      {platforms.map((platform) => (
        <TabPanel key={platform.id} id={platform.id} active={active} idPrefix={idPrefix}>
          <p className="mb-4 text-sm text-slate-600">{platform.summary}</p>
          <ol className="space-y-5">
            {platform.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.title}
                  </h4>
                  <p className="mt-0.5 text-sm text-slate-600">{step.body}</p>
                  {step.code && (
                    <div className="mt-2">
                      <CodeBlock code={step.code} label={step.title} />
                    </div>
                  )}
                  {step.note && <p className="mt-1.5 text-xs text-slate-600">{step.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </TabPanel>
      ))}
    </div>
  );
}
