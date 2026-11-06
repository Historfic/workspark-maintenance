import { clsx } from "clsx";
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "emergency" | "ink" | "outline" | "muted" | "followup" | "done";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-bg text-ink border border-line",
  emergency: "bg-emergency text-white",
  ink: "bg-ink text-white",
  outline: "border border-ink text-ink",
  muted: "text-ink-muted",
  followup: "bg-followup-bg text-followup border border-followup-line",
  done: "bg-done-bg text-done",
};

export function Badge({
  tone,
  className,
  children,
}: {
  tone: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium tracking-wide uppercase whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
