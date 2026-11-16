"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getUserFacingAuthError } from "@/lib/api";

function getSafeReturnPath(value: string | null): string {
  if (!value) return "/dashboard";

  try {
    const destination = new URL(value, window.location.origin);
    if (
      destination.origin !== window.location.origin ||
      destination.pathname === "/login" ||
      destination.pathname === "/register"
    ) {
      return "/dashboard";
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/dashboard";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(getSafeReturnPath(searchParams.get("next")));
    }
  }, [router, searchParams, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password || Array.from(password).length > 128) {
      setError("Enter a password with no more than 128 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(normalizedEmail, password);
      router.replace(getSafeReturnPath(searchParams.get("next")));
    } catch (loginError: unknown) {
      setError(getUserFacingAuthError(loginError, "Could not sign in."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <main
        role="status"
        className="flex min-h-[calc(100vh-73px)] flex-1 items-center justify-center bg-[#080b12] text-sm text-slate-400"
      >
        Checking your account…
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-[#080b12] px-5 py-12 text-slate-100 sm:px-8">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111722] p-6 shadow-2xl shadow-black/30 sm:p-9">
        <p className="text-sm font-medium text-indigo-300">Welcome back</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Sign in to DocuMind
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Continue exploring your documents and conversations.
        </p>

        {searchParams.get("registered") === "1" && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200"
          >
            Your account was created. Sign in to continue.
          </p>
        )}

        {status === "unavailable" && (
          <div
            role="status"
            className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3"
          >
            <p className="text-xs leading-5 text-amber-100/80">
              We could not check your existing sign-in. You can still try to
              sign in.
            </p>
            <button
              type="button"
              onClick={() => void refreshUser()}
              className="shrink-0 text-xs font-medium text-amber-100 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-white/10 bg-[#090d15] px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Password
            </label>
            <div className="flex min-h-12 items-center rounded-xl border border-white/10 bg-[#090d15] pr-2 focus-within:border-indigo-300/50 focus-within:ring-2 focus-within:ring-indigo-300/10">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-full min-h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="rounded-lg px-2 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New to DocuMind?{" "}
          <Link
            href="/register"
            className="font-medium text-indigo-200 underline decoration-indigo-200/30 underline-offset-4 hover:text-white"
          >
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-[calc(100vh-73px)] flex-1 items-center justify-center bg-[#080b12] text-sm text-slate-400"
        >
          Loading sign in…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
