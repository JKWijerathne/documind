"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getUserFacingAuthError } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/chat", label: "AI chat" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout, refreshUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      router.replace("/login");
    } catch (error: unknown) {
      setLogoutError(
        getUserFacingAuthError(
          error,
          "Could not log out. Please try again.",
        ),
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080b12]/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-4 sm:flex-nowrap sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="DocuMind home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-400 text-sm font-black text-slate-950">
            D
          </span>
          <span className="text-base font-semibold tracking-tight text-white">
            DocuMind<span className="text-indigo-300">.</span>
          </span>
        </Link>
        <div className="flex w-full items-center justify-between sm:w-auto sm:gap-4">
          {status === "loading" ? (
            <span role="status" className="text-xs text-slate-500">
              Checking account…
            </span>
          ) : status === "authenticated" && user ? (
            <>
              <nav
                aria-label="Main navigation"
                className="flex items-center gap-0.5 sm:gap-1"
              >
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={`rounded-lg px-2 py-2 text-xs transition hover:bg-white/5 hover:text-white sm:px-4 sm:text-sm ${
                      pathname === link.href
                        ? "bg-white/[0.07] text-white"
                        : "text-slate-400"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <span
                className="hidden max-w-48 truncate text-xs text-slate-400 md:block"
                title={user.email}
              >
                {user.email}
              </span>
              <span
                aria-label={`Signed in as ${user.email}`}
                title={user.email}
                className="flex size-8 items-center justify-center rounded-full border border-indigo-300/20 bg-indigo-300/10 text-xs font-semibold text-indigo-100 md:hidden"
              >
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50 sm:text-sm"
              >
                {isLoggingOut ? "Signing out…" : "Log out"}
              </button>
            </>
          ) : status === "unavailable" ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-amber-200 sm:inline">
                Account check unavailable
              </span>
              <button
                type="button"
                onClick={() => void refreshUser()}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
              >
                Retry
              </button>
            </div>
          ) : (
            <nav aria-label="Account navigation" className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 sm:px-4"
              >
                Get started
              </Link>
            </nav>
          )}
        </div>
      </div>
      {logoutError && (
        <p
          role="alert"
          className="border-t border-rose-400/20 bg-rose-400/[0.07] px-5 py-2 text-center text-xs text-rose-200"
        >
          {logoutError}
        </p>
      )}
    </header>
  );
}
