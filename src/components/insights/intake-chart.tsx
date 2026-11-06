import { clsx } from "clsx";
import type { DayBucket } from "@/lib/dashboard/stats";
import { ChartTooltip, tooltipAlign } from "./chart-tooltip";

const PLOT_HEIGHT = 72;
const LABEL_ROOM = 20;
const DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function tickets(count: number): string {
  return `${count} ${count === 1 ? "ticket" : "tickets"}`;
}

export function IntakeChart({ buckets }: { buckets: readonly DayBucket[] }) {
  const max = Math.max(0, ...buckets.map((bucket) => bucket.count));
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const todayIndex = buckets.length - 1;
  const peakIndex = max > 0 ? buckets.findLastIndex((bucket) => bucket.count === max) : -1;
  const summary = buckets.map((bucket) => `${bucket.label} ${bucket.count}`).join(", ");

  return (
    <section
      aria-labelledby="intake-chart-heading"
      className="rounded border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="intake-chart-heading"
          className="text-xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          Tickets received, last 7 days
        </h2>
        <span className="font-mono text-sm text-ink tabular-nums">{total}</span>
      </div>
      <p className="sr-only">Tickets received per day, oldest first: {summary}.</p>
      <div
        className="mt-4 grid grid-cols-7 items-end gap-2 border-b border-line"
        style={{ height: PLOT_HEIGHT + LABEL_ROOM }}
      >
        {buckets.map((bucket, index) => {
          const date = DATE.format(new Date(`${bucket.day}T00:00:00Z`));
          const labelled = index === todayIndex || index === peakIndex;
          return (
            <div
              key={bucket.day}
              role="img"
              tabIndex={0}
              aria-label={`${date}: ${tickets(bucket.count)}`}
              className="group flex h-full flex-col items-center justify-end"
            >
              <span className="relative h-0 w-full">
                <ChartTooltip align={tooltipAlign(index, buckets.length)}>
                  {date} · <strong className="font-semibold">{tickets(bucket.count)}</strong>
                </ChartTooltip>
              </span>
              {labelled && (
                <span className="mb-1 font-mono text-xs leading-none text-ink tabular-nums">
                  {bucket.count}
                </span>
              )}
              <span
                style={
                  bucket.count > 0 ? { height: (bucket.count / max) * PLOT_HEIGHT } : undefined
                }
                className={clsx(
                  "w-3/5 max-w-6 rounded-t transition-opacity group-hover:opacity-80",
                  bucket.count > 0 ? "bg-accent" : "h-[3px] bg-line",
                )}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden className="mt-1.5 grid grid-cols-7 gap-2 text-center text-xs text-ink-muted">
        {buckets.map((bucket, index) => (
          <span key={bucket.day} className={clsx(index === todayIndex && "font-medium text-ink")}>
            {bucket.label}
          </span>
        ))}
      </div>
    </section>
  );
}
