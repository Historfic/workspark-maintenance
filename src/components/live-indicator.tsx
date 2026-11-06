"use client";

import { clsx } from "clsx";
import type { Connection } from "@/lib/dashboard/feed-reducer";

type Tone = "light" | "dark";

const LABEL: Record<Connection, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
};

const TEXT: Record<Tone, string> = {
  light: "text-ink-muted",
  dark: "text-white/80",
};

const IDLE_DOT: Record<Tone, string> = {
  light: "bg-ink-muted/50",
  dark: "bg-white/40",
};

export function LiveIndicator({
  connection,
  tone = "light",
}: {
  connection: Connection;
  tone?: Tone;
}) {
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center gap-2 text-sm", TEXT[tone])}
      role="status"
    >
      <span
        aria-hidden
        className={clsx(
          "inline-block size-2 rounded-full",
          connection === "live"
            ? "bg-done"
            : connection === "reconnecting"
              ? "bg-followup-line"
              : IDLE_DOT[tone],
        )}
      />
      {LABEL[connection]}
    </span>
  );
}
