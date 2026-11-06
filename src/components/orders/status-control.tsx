"use client";

import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { clsx } from "clsx";
import type { WorkOrderRow } from "@/lib/db/types";
import { STATUS_LABEL } from "@/lib/dashboard/labels";
import { STATUSES, type Status } from "@/lib/triage/schema";

type Size = "sm" | "lg";

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  lg: "h-11 px-3.5 text-sm",
};

export function StatusControl({
  order,
  size = "sm",
  onChange,
}: {
  order: WorkOrderRow;
  size?: Size;
  onChange: (id: string, status: Status) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function change(value: string) {
    const status = STATUSES.find((s) => s === value);
    if (!status || status === order.status) return;
    setError(null);
    setPending(true);
    try {
      await onChange(order.id, status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <RadioGroup.Root
        value={order.status}
        onValueChange={change}
        disabled={pending}
        aria-label={`Status for ${order.issue_type} ticket${order.unit ? ` in ${order.unit}` : ""}`}
        className="inline-flex rounded border border-line bg-surface p-0.5"
      >
        {STATUSES.map((status) => (
          <RadioGroup.Item
            key={status}
            value={status}
            className={clsx(
              "cursor-pointer rounded font-medium transition-colors disabled:cursor-wait",
              SIZE[size],
              status === order.status
                ? status === "Done"
                  ? "bg-done-bg text-done"
                  : "bg-ink text-white"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {STATUS_LABEL[status]}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {error && (
        <p role="alert" className="mt-1 text-xs text-emergency">
          {error}
        </p>
      )}
    </div>
  );
}
