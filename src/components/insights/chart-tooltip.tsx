import { clsx } from "clsx";
import type { ReactNode } from "react";

export type TooltipAlign = "start" | "center" | "end";

const ALIGN: Record<TooltipAlign, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

export function tooltipAlign(index: number, count: number): TooltipAlign {
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "center";
}

export function ChartTooltip({
  align = "center",
  children,
}: {
  align?: TooltipAlign;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none absolute bottom-full z-10 mb-1.5 hidden rounded bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow-card group-hover:block group-focus-visible:block",
        ALIGN[align],
      )}
    >
      {children}
    </span>
  );
}
