"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  // `reset` only re-renders the boundary; the refresh re-runs the server component that threw.
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">The dashboard could not load</h1>
      <p className="mt-2 text-sm text-ink-muted">
        The work orders could not be read from the database. Check the connection and try again.
      </p>
      <Button className="mt-4" onClick={retry}>
        Try again
      </Button>
    </main>
  );
}
