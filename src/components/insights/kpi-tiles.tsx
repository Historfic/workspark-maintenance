"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  CheckCircleIcon,
  PhoneCallIcon,
  WarningIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";
import { clsx } from "clsx";
import type { FilterKey } from "@/lib/dashboard/filters";

const TILES: ReadonlyArray<{ key: FilterKey; label: string; icon: Icon; chip: string }> = [
  {
    key: "emergency",
    label: "Emergency",
    icon: WarningIcon,
    chip: "bg-emergency/10 text-emergency",
  },
  {
    key: "followup",
    label: "Needs follow-up",
    icon: PhoneCallIcon,
    chip: "bg-followup-bg text-followup",
  },
  { key: "in_progress", label: "In progress", icon: WrenchIcon, chip: "bg-accent/10 text-accent" },
  { key: "done", label: "Resolved", icon: CheckCircleIcon, chip: "bg-done-bg text-done" },
];

export function KpiTiles({
  counts,
  active,
  onSelect,
}: {
  counts: Record<FilterKey, number>;
  active: FilterKey;
  onSelect: (key: FilterKey) => void;
}) {
  return (
    <div role="group" aria-label="Ticket counts" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILES.map(({ key, label, icon: TileIcon, chip }) => {
        const pressed = active === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(pressed ? "all" : key)}
            className={clsx(
              "flex cursor-pointer items-center gap-3 rounded border bg-surface p-4 text-left shadow-card transition-colors hover:border-accent",
              pressed ? "border-accent ring-2 ring-accent" : "border-line",
            )}
          >
            <span
              aria-hidden
              className={clsx("flex size-9 shrink-0 items-center justify-center rounded", chip)}
            >
              <TileIcon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[28px] leading-none text-ink tabular-nums">
                {counts[key]}
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
