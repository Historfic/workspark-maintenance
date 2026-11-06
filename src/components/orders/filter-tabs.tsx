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
      <Tabs.List
        aria-label="Filter work orders"
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {FILTERS.map((filter) => (
          <Tabs.Trigger
            key={filter.key}
            value={filter.key}
            className={clsx(
              "-mb-px flex h-10 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
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
      <Tabs.Content value={value} forceMount>
        {children}
      </Tabs.Content>
    </Tabs.Root>
  );
}
