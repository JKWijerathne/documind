"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/health`
        );

        const data: { status?: string } =
          await response.json();

        setStatus(data.status ?? "Unknown");
      } catch {
        setStatus("Backend unavailable");
      }
    }

    checkBackend();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">
        DocuMind
      </h1>

      <p className="text-gray-600">
        AI-Powered Document Assistant
      </p>

      <p>
        Backend Status: {status}
      </p>
    </main>
  );
}