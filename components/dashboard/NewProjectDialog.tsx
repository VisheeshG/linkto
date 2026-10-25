"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import type { Brand } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { generateUniqueProjectSlug } from "@/lib/generators";
import { isValidSlug } from "@/lib/slug-utils";
import { siteConfig } from "@/lib/site-config";

/** Create a project (campaign): name, brand, short URL slug, description. */
export function NewProjectDialog({
  open,
  onClose,
  brands,
  defaultBrandId = null,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  brands: Brand[];
  defaultBrandId?: string | null;
  onSubmit: (name: string, description: string, slug: string, brandId: string | null) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState("");
  const [slugMode, setSlugMode] = useState<"auto" | "custom">("auto");
  const [slug, setSlug] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const host = siteConfig.url.replace(/^https?:\/\//, "");
  const brandSlug = brands.find((b) => b.id === brandId)?.slug;

  const generate = async () => {
    setGenerating(true);
    try {
      setSlug(await generateUniqueProjectSlug(supabase));
    } catch (error) {
      console.error("Error generating slug:", error);
      setErrors((e) => ({ ...e, slug: "Couldn't generate a slug. Try again or choose your own." }));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setBrandId(defaultBrandId ?? "");
    setSlugMode("auto");
    setSlug("");
    setErrors({});
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Give the project a name.";
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) next.slug = slugMode === "auto" ? "Still generating — try again in a moment." : "Choose a slug.";
    else if (slugMode === "custom" && !isValidSlug(cleanSlug) && !/^[a-z0-9]$/.test(cleanSlug))
      next.slug = "Use lowercase letters, numbers and single hyphens.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      if (await onSubmit(name.trim(), description.trim(), cleanSlug, brandId || null)) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title="New project"
      description="A project is one campaign. Its links and analytics live together."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="new-project-form" loading={submitting}>
            Create project
          </Button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Project name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali launch 2026" autoFocus />
        </Field>
        <Field label="Brand">
          <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-slate-800">URL slug</legend>
          <div className="mb-2 inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5" role="radiogroup" aria-label="Slug mode">
            {(["auto", "custom"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={slugMode === mode}
                onClick={() => {
                  setSlugMode(mode);
                  setErrors((e) => ({ ...e, slug: undefined }));
                  if (mode === "custom") setSlug("");
                  else void generate();
                }}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  slugMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {mode === "auto" ? "Short & random" : "Choose my own"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="Project slug"
              aria-describedby="new-project-slug-help"
              invalid={Boolean(errors.slug)}
              value={slug}
              readOnly={slugMode === "auto"}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder={slugMode === "auto" ? "generating…" : "e.g. diwali-launch"}
              className="min-w-0 flex-1 font-mono"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {slugMode === "auto" && (
              <Button
                variant="secondary"
                icon={RefreshCw}
                label="Generate another slug"
                onClick={() => void generate()}
                loading={generating}
              />
            )}
          </div>
          <p
            id="new-project-slug-help"
            role={errors.slug ? "alert" : undefined}
            className={`mt-1.5 text-xs ${errors.slug ? "text-sm text-rose-700" : "text-slate-600"}`}
          >
            {errors.slug ?? (
              <>
                {host}/{brandSlug ? `${brandSlug}/` : ""}
                <span className="font-semibold text-slate-800">{slug || "…"}</span>/link/creator
              </>
            )}
          </p>
        </fieldset>

        <Field label="Description" optional>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </form>
    </Dialog>
  );
}
