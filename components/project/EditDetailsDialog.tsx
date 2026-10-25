"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";

export type DetailsValues = { name: string; description: string; slug?: string };

/** Rename + describe a project or brand (and optionally change its slug). */
export function EditDetailsDialog({
  open,
  onClose,
  title,
  nameLabel = "Name",
  initial,
  slug,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  nameLabel?: string;
  initial: DetailsValues;
  /** Show a slug field with this URL prefix and validator (returns an error or null). */
  slug?: { prefix: string; hint?: string; validate: (value: string) => string | null };
  onSave: (values: DetailsValues) => Promise<boolean>;
}) {
  const [values, setValues] = useState<DetailsValues>(initial);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initial);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = `${nameLabel} is required.`;
    if (slug) {
      const err = slug.validate((values.slug ?? "").trim().toLowerCase());
      if (err) next.slug = err;
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const ok = await onSave({
        name: values.name.trim(),
        description: values.description.trim(),
        slug: slug ? (values.slug ?? "").trim().toLowerCase() : undefined,
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-details-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-details-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label={nameLabel} error={errors.name}>
          <Input
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            autoFocus
          />
        </Field>
        {slug && (
          <Field
            label="URL slug"
            error={errors.slug}
            hint={
              <>
                {slug.prefix}
                <span className="font-semibold">{values.slug || "…"}</span>
                {slug.hint ? ` — ${slug.hint}` : ""}
              </>
            }
          >
            <Input
              value={values.slug ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
              className="font-mono"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
        )}
        <Field label="Description" optional>
          <Textarea
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            rows={3}
          />
        </Field>
      </form>
    </Dialog>
  );
}
