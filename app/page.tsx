"use client";

import { useEffect, useState } from "react";

type Health = { status: string; time: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">pampers-jumpo</h1>

      {error ? (
        <p className="text-red-600">Backend unreachable: {error}</p>
      ) : health ? (
        <p className="text-green-600">
          Backend {health.status} &middot; {health.time}
        </p>
      ) : (
        <p className="text-gray-500">Checking backend&hellip;</p>
      )}
    </main>
  );
}
