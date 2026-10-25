"use client";

import { useState } from "react";
import { Lock, X, Eye, EyeOff } from "lucide-react";

interface PasswordVerificationModalProps {
  projectName: string;
  projectSlug: string;
  onVerify: (password: string) => Promise<boolean>;
  onClose?: () => void;
}

export function PasswordVerificationModal({
  projectName,
  onVerify,
  onClose,
}: PasswordVerificationModalProps) {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const isValid = await onVerify(password);

      if (!isValid) {
        setError("Invalid password. Please try again.");
        setPassword("");
        setShowPasswordText(false);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Failed to verify password. Please try again."
      );
      console.error("Password verification error:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            <Lock className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Protected Project
          </h2>
          <p className="text-slate-600">
            Enter the password to view <strong>{projectName}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Access Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPasswordText ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition ${
                  error
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                placeholder="Enter password"
                autoFocus
                disabled={isVerifying}
              />
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                disabled={isVerifying}
                title={showPasswordText ? "Hide password" : "Show password"}
              >
                {showPasswordText ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <span className="mr-1">⚠️</span> {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-lg transition disabled:bg-purple-400 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Verifying...
              </span>
            ) : (
              "Access Project"
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600">
            <strong>Note:</strong> This project is password-protected. Contact
            the project owner if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
