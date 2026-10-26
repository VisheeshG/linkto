"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import NextLink from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Button, Field, Input } from "@/components/ui";

export function Auth({ mode = "signin" }: { mode?: "signin" | "signup" }) {
  const [isSignUp, setIsSignUp] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const { signUp, signIn, signOut } = useAuth();

  useEffect(() => {
    // Keep local state in sync if parent changes mode prop
    setIsSignUp(mode === "signup");
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;

        // Show success toast
        toast.success("Account created successfully! Please sign in.", {
          duration: 4000,
        });

        // Ensure no active session after signup so user sees login
        await signOut();
        // Wait a bit for auth state to clear before redirecting
        await new Promise((resolve) => setTimeout(resolve, 100));
        router.push("/login");
        return;
      }

      const { error } = await signIn(email, password);
      if (error) throw error;

      // Show success toast
      toast.success("Welcome back! Logged in successfully.", {
        duration: 3000,
      });

      // After successful login, navigate to dashboard without leaving login in history
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setError("");
    setIsSignUp(!isSignUp);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <NextLink href="/" className="inline-flex items-center gap-2 rounded-lg" aria-label="Linkto home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 p-1.5 shadow-sm">
              <BrandLogo size={40} priority className="h-7 w-7" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">Linkto</span>
          </NextLink>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isSignUp
              ? "Track every creator click with branded links."
              : "Sign in to see your campaigns."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <Field label="Full name">
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                  fullWidth
                />
              </Field>
            )}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
                fullWidth
              />
            </Field>

            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-slate-800">
                Password
              </label>
              <div className="relative">
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  aria-describedby={isSignUp ? "auth-password-hint" : undefined}
                  required
                  minLength={6}
                  fullWidth
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {isSignUp && (
                <p id="auth-password-hint" className="mt-1.5 text-xs text-slate-600">
                  At least 6 characters.
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isSignUp ? "Already have an account? " : "New to Linkto? "}
          <NextLink
            href={isSignUp ? "/login" : "/signup"}
            onClick={switchMode}
            className="font-semibold text-primary-700 hover:text-primary-800"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </NextLink>
        </p>
      </div>
    </div>
  );
}
