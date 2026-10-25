"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { isValidSlug, slugifyName } from "@/lib/slug-utils";
import { siteConfig } from "@/lib/site-config";

/** Create a brand: name, URL slug (auto from the name until edited), description. */
export function NewBrandDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, slug: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const host = siteConfig.url.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setSlug("");
    setSlugTouched(false);
    setErrors({});
  }, [open]);

  useEffect(() => {
    if (!slugTouched) setSlug(name.trim() ? slugifyName(name) : "");
  }, [name, slugTouched]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter the brand's name.";
    const cleanSlug = slug.trim().toLowerCase();
    if (!isValidSlug(cleanSlug)) next.slug = "Use 2–48 lowercase letters, numbers and single hyphens.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      if (await onSubmit(name.trim(), description.trim(), cleanSlug)) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title="New brand"
      description="Brands group campaigns and appear in tracking URLs."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="new-brand-form" loading={submitting}>
            Create brand
          </Button>
        </>
      }
    >
      <form id="new-brand-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Brand name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance with Sharan" autoFocus />
        </Field>
        <Field
          label="URL slug"
          error={errors.slug}
          hint={
            <>
              {host}/<span className="font-semibold text-slate-800">{slug || "brand"}</span>/project/…
            </>
          }
        >
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            className="font-mono"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Description" optional>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </form>
    </Dialog>
  );
}
