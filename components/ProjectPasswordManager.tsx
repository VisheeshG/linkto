"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Skeleton,
} from "@/components/ui";
import { formatRelative } from "@/lib/format";

interface ProjectPassword {
  id: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

interface ProjectPasswordManagerProps {
  projectId: string;
  accessToken: string;
  projectSlug?: string;
  /** Rendered inside another dialog: no card chrome of its own. */
  embedded?: boolean;
}

const MIN_LENGTH = 6;

/** Access passwords for a project's shared client report. */
export function ProjectPasswordManager({
  projectId,
  accessToken,
  projectSlug,
  embedded = false,
}: ProjectPasswordManagerProps) {
  const [passwords, setPasswords] = useState<ProjectPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectPassword | null>(null);

  const loadPasswords = async () => {
    try {
      const response = await fetch(`/api/project-passwords?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Failed to load passwords");
      const data = await response.json();
      setPasswords(data.passwords || []);
    } catch (error) {
      console.error("Error loading passwords:", error);
      toast.error("Failed to load passwords");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadPasswords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, accessToken]);

  const resetForm = () => {
    setShowForm(false);
    setNewPassword("");
    setNewDescription("");
    setPasswordError(null);
    setShowPasswordText(false);
  };

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < MIN_LENGTH) {
      setPasswordError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/project-passwords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          password: newPassword,
          description: newDescription.trim() || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to create password");
      const data = await response.json();
      setPasswords([data.password, ...passwords]);
      resetForm();
      toast.success("Password added");
    } catch (error) {
      console.error("Error creating password:", error);
      toast.error("Failed to create password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePassword = async (passwordId: string) => {
    try {
      const response = await fetch(`/api/project-passwords?id=${passwordId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Failed to delete password");
      setPasswords((prev) => prev.filter((p) => p.id !== passwordId));
      if (projectSlug) {
        try {
          localStorage.removeItem(`project_auth_${projectSlug}`);
        } catch {
          // ignore
        }
      }
      toast.success("Password deleted");
    } catch (error) {
      console.error("Error deleting password:", error);
      toast.error("Failed to delete password");
    }
  };

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-700">
          <ShieldCheck
            className={`h-4 w-4 ${passwords.length ? "text-emerald-600" : "text-slate-500"}`}
            aria-hidden
          />
          {loading
            ? "Checking protection…"
            : passwords.length
              ? `Protected · ${passwords.length} active ${passwords.length === 1 ? "password" : "passwords"}`
              : "Not protected · anyone with the link can view"}
        </p>
        {!showForm && (
          <Button size="sm" icon={Plus} onClick={() => setShowForm(true)} disabled={loading}>
            Add password
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleCreatePassword}
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          noValidate
        >
          <div>
            <label htmlFor="new-project-password" className="mb-1.5 block text-sm font-medium text-slate-800">
              Password
            </label>
            <div className="relative">
              <Input
                id="new-project-password"
                type={showPasswordText ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                autoComplete="new-password"
                aria-describedby="new-project-password-help"
                invalid={Boolean(passwordError)}
                className="pr-11"
                disabled={isSubmitting}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPasswordText((v) => !v)}
                aria-label={showPasswordText ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              >
                {showPasswordText ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <p
              id="new-project-password-help"
              role={passwordError ? "alert" : undefined}
              className={`mt-1.5 text-xs ${passwordError ? "text-sm text-rose-700" : "text-slate-600"}`}
            >
              {passwordError ?? `At least ${MIN_LENGTH} characters.`}
            </p>
          </div>
          <Field label="Who is it for?" optional hint="e.g. “Acme marketing team” — helps you revoke the right one later.">
            <Input
              id="new-project-password-label"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Add password
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingBlock label="Loading passwords">
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </LoadingBlock>
      ) : passwords.length === 0 ? (
        !showForm && (
          <EmptyState
            icon={KeyRound}
            title="No passwords yet"
            description="Add a password to require it before anyone can open the client report. Give each client their own so you can revoke access individually."
          />
        )
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {passwords.map((password) => (
            <li key={password.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden>
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {password.description || "Unnamed password"}
                </p>
                <p className="text-xs text-slate-600">
                  Added {formatRelative(password.created_at) ?? "—"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                iconClassName="text-rose-600"
                label={`Delete password ${password.description || ""}`.trim()}
                onClick={() => setPendingDelete(password)}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-600">
        Every password opens the same report. Deleting one signs out only the
        people using it.
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await handleDeletePassword(pendingDelete.id);
        }}
        title="Delete this password?"
        description={
          <>
            Anyone using <strong>{pendingDelete?.description || "this password"}</strong> will
            lose access to the client report.
          </>
        }
        confirmLabel="Delete password"
      />
    </div>
  );

  if (embedded) return body;
  return (
    <Card>
      <CardHeader title="Access passwords" description="Control who can open the client report." icon={KeyRound} />
      {body}
    </Card>
  );
}
