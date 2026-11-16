"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getUserFacingAuthError } from "@/lib/api";

const passwordRequirements = [
  { label: "12–128 characters", test: (value: string) => {
    const length = Array.from(value).length;
    return length >= 12 && length <= 128;
  } },
  { label: "A lowercase letter", test: (value: string) => /\p{Ll}/u.test(value) },
  { label: "An uppercase letter", test: (value: string) => /\p{Lu}/u.test(value) },
  { label: "A number", test: (value: string) => /\p{N}/u.test(value) },
  {
    label: "A symbol",
    test: (value: string) => /[^\p{L}\p{N}\s]/u.test(value),
  },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isStrongPassword(password: string): boolean {
  return passwordRequirements.every((requirement) => requirement.test(password));
}

function RegisterForm() {
  const router = useRouter();
  const { status, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Your password does not meet all the requirements below.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(normalizedEmail, password);
      router.replace("/login?registered=1");
    } catch (registrationError: unknown) {
      setError(
        getUserFacingAuthError(
          registrationError,
          "Could not create your account.",
        ),
      );
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
        <p className="text-sm font-medium text-indigo-300">Start your library</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Create an account
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Your documents and conversations will be ready when you sign in.
        </p>

        {status === "unavailable" && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/80"
          >
            We could not check your existing sign-in. You can still try to
            create an account.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="register-email"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Email
            </label>
            <input
              id="register-email"
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
              htmlFor="register-password"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Password
            </label>
            <div className="flex min-h-12 items-center rounded-xl border border-white/10 bg-[#090d15] pr-2 focus-within:border-indigo-300/50 focus-within:ring-2 focus-within:ring-indigo-300/10">
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-full min-h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="Create a strong password"
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
            <ul className="mt-3 grid gap-1.5 text-xs text-slate-500 sm:grid-cols-2">
              {passwordRequirements.map((requirement) => {
                const isMet = requirement.test(password);
                return (
                  <li
                    key={requirement.label}
                    className={isMet ? "text-emerald-300" : undefined}
                  >
                    <span aria-hidden="true">{isMet ? "✓ " : "• "}</span>
                    {requirement.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Confirm password
            </label>
            <div className="flex min-h-12 items-center rounded-xl border border-white/10 bg-[#090d15] pr-2 focus-within:border-indigo-300/50 focus-within:ring-2 focus-within:ring-indigo-300/10">
              <input
                id="register-confirm-password"
                name="confirm-password"
                type={showConfirmation ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="h-full min-h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmation((visible) => !visible)}
                aria-label={
                  showConfirmation ? "Hide confirmation" : "Show confirmation"
                }
                className="rounded-lg px-2 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                {showConfirmation ? "Hide" : "Show"}
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
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-200 underline decoration-indigo-200/30 underline-offset-4 hover:text-white"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return <RegisterForm />;
}
