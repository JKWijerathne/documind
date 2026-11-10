"use client";

import { useEffect, useState } from "react";
import { checkBackendHealth } from "@/lib/api";

type Health = "checking" | "online" | "offline";

export default function BackendStatus() {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let active = true;

    checkBackendHealth()
      .then((isHealthy) => {
        if (active) setHealth(isHealthy ? "online" : "offline");
      })
      .catch(() => {
        if (active) setHealth("offline");
      });

    return () => {
      active = false;
    };
  }, []);

  const isOnline = health === "online";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
      <span
        className={`size-1.5 rounded-full ${
          health === "checking"
            ? "animate-pulse bg-amber-300"
            : isOnline
              ? "bg-emerald-400"
              : "bg-rose-400"
        }`}
      />
      {health === "checking"
        ? "Connecting to API"
        : isOnline
          ? "API connected"
          : "API unavailable"}
    </span>
  );
}
