"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

function LoadingState({ message }: { message: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-[calc(100vh-73px)] flex-1 items-center justify-center bg-[#080b12] px-5 text-sm text-slate-400"
    >
      {message}
    </main>
  );
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, error, refreshUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const destination = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(destination)}`);
  }, [pathname, router, status]);

  if (status === "authenticated") return children;

  if (status === "unavailable") {
    return (
      <main className="flex min-h-[calc(100vh-73px)] flex-1 items-center justify-center bg-[#080b12] px-5 text-slate-100">
        <div className="max-w-md text-center">
          <p role="alert" className="text-sm leading-6 text-amber-200">
            {error ?? "We could not verify your sign-in status."}
          </p>
          <button
            type="button"
            onClick={() => void refreshUser()}
            className="mt-5 rounded-xl bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return <LoadingState message="Checking your sign-in…" />;
}
