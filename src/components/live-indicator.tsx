"use client";

import { clsx } from "clsx";
import type { Connection } from "@/lib/dashboard/feed-reducer";

const LABEL: Record<Connection, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
};

export function LiveIndicator({ connection }: { connection: Connection }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-sm text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={clsx(
          "inline-block size-2 rounded-full",
          connection === "live"
            ? "bg-done"
            : connection === "reconnecting"
              ? "bg-followup-line"
              : "bg-ink-muted/50",
        )}
      />
      {LABEL[connection]}
    </span>
  );
}
