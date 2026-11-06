"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">The dashboard could not load</h1>
      <p className="mt-2 text-sm text-ink-muted">
        The work orders could not be read from the database. Check the connection and try again.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
