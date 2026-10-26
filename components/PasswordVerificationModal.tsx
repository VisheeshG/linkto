"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { PublicShell } from "@/components/public/PublicShell";

interface PasswordVerificationModalProps {
  projectName: string;
  projectSlug: string;
  onVerify: (password: string) => Promise<boolean>;
}

/** Full-page password screen shown before a protected shared report. */
export function PasswordVerificationModal({
  projectName,
  onVerify,
}: PasswordVerificationModalProps) {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Enter the password you were given.");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const isValid = await onVerify(password);

      if (!isValid) {
        setError("That password didn't work. Check it and try again.");
        setPassword("");
        setShowPasswordText(false);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't check the password. Please try again."
      );
      console.error("Password verification error:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <PublicShell>
      <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:mt-12 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <Lock className="h-6 w-6 text-primary-600" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{projectName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            This report is password-protected.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="report-password" className="mb-1.5 block text-sm font-medium text-slate-800">
              Password
            </label>
            <div className="relative">
              <Input
                id="report-password"
                type={showPasswordText ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                invalid={Boolean(error)}
                aria-describedby={error ? "report-password-error" : undefined}
                autoComplete="current-password"
                autoFocus
                disabled={isVerifying}
                fullWidth
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPasswordText((v) => !v)}
                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                disabled={isVerifying}
                aria-label={showPasswordText ? "Hide password" : "Show password"}
                aria-pressed={showPasswordText}
              >
                {showPasswordText ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {error && (
              <p id="report-password-error" role="alert" className="mt-1.5 text-sm text-rose-700">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" loading={isVerifying} className="w-full">
            {isVerifying ? "Checking…" : "View report"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600">
          Don&apos;t have the password? Ask the person who shared this link.
        </p>
      </div>
    </PublicShell>
  );
}
