import { clsx } from "clsx";
import type { PrioritySlice } from "@/lib/dashboard/stats";
import type { Priority } from "@/lib/triage/schema";
import { ChartTooltip, tooltipAlign } from "./chart-tooltip";

const FILL: Record<Priority, string> = {
  Emergency: "bg-emergency",
  High: "bg-ink",
  Medium: "bg-ink-muted",
  Low: "bg-priority-low",
};

const LIST = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });

function describe(slices: readonly PrioritySlice[]): string {
  const parts = slices.map((slice) => `${slice.count} ${slice.priority.toLowerCase()}`);
  return `${LIST.format(parts)} open tickets.`;
}

export function PriorityBar({ slices }: { slices: readonly PrioritySlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const visible = slices.filter((slice) => slice.count > 0);

  return (
    <section
      aria-labelledby="priority-heading"
      className="flex flex-col rounded border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="priority-heading"
          className="text-xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          Open tickets by priority
        </h2>
        <span className="font-mono text-sm text-ink tabular-nums">{total}</span>
      </div>
      <div className="my-auto pt-4">
        {total === 0 ? (
          <p className="text-sm text-ink-muted">No open tickets.</p>
        ) : (
          <>
            <p className="sr-only">{describe(slices)}</p>
            <div className="flex h-3.5 gap-0.5">
              {visible.map((slice, index) => (
                <span
                  key={slice.priority}
                  role="img"
                  tabIndex={0}
                  aria-label={`${slice.priority}: ${slice.count} open`}
                  style={{ flexGrow: slice.count }}
                  className="group relative -my-1.5 min-w-1.5 basis-0 py-1.5"
                >
                  <span
                    className={clsx(
                      "block h-full transition-opacity group-first:rounded-l group-last:rounded-r group-hover:opacity-80",
                      FILL[slice.priority],
                    )}
                  />
                  <ChartTooltip align={tooltipAlign(index, visible.length)}>
                    {slice.priority} · <strong className="font-semibold">{slice.count}</strong> open
                    · {Math.round((slice.count / total) * 100)}%
                  </ChartTooltip>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {slices.map((slice) => (
          <li key={slice.priority} className="flex items-center gap-1.5">
            <span aria-hidden className={clsx("size-2.5 rounded-[2px]", FILL[slice.priority])} />
            {slice.priority}
            <span className="font-mono text-ink tabular-nums">{slice.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
