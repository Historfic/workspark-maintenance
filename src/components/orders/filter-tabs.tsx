"use client";

import { Tabs } from "radix-ui";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { FILTERS, type FilterKey } from "@/lib/dashboard/filters";

export function FilterTabs({
  value,
  counts,
  onChange,
  children,
}: {
  value: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (key: FilterKey) => void;
  children: ReactNode;
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => onChange(FILTERS.find((f) => f.key === next)?.key ?? "all")}
    >
      <div className="overflow-x-auto [scrollbar-width:none] md:overflow-visible">
        <Tabs.List
          aria-label="Filter work orders"
          className="flex w-max min-w-full gap-1 border-b border-line md:w-auto md:flex-wrap"
        >
          {FILTERS.map((filter) => (
            <Tabs.Trigger
              key={filter.key}
              value={filter.key}
              onFocus={(event) =>
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })
              }
              className={clsx(
                "-mb-px flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:-outline-offset-2 md:h-10",
                value === filter.key
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {filter.label}
              <span className="rounded bg-bg px-1.5 font-mono text-xs text-ink-muted">
                {counts[filter.key]}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>
      <Tabs.Content value={value} forceMount>
        {children}
      </Tabs.Content>
    </Tabs.Root>
  );
}
