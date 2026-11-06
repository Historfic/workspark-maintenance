"use client";

import { clsx } from "clsx";
import type { Connection } from "@/lib/dashboard/feed-reducer";

const LABEL: Record<Connection, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
};

const DOT: Record<Connection, string> = {
  connecting: "bg-white/40",
  live: "bg-done",
  reconnecting: "bg-followup-line",
};

export function LiveIndicator({ connection }: { connection: Connection }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-sm text-white/80" role="status">
      <span aria-hidden className={clsx("inline-block size-2 rounded-full", DOT[connection])} />
      {LABEL[connection]}
    </span>
  );
}
