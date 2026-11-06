"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
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
    if (pending) return;
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
        aria-busy={pending}
        aria-label={`Status for ${order.issue_type} ticket${order.unit ? ` in ${order.unit}` : ""}`}
        className={clsx(
          "inline-flex rounded border border-line bg-surface p-0.5",
          pending && "cursor-wait opacity-70",
        )}
      >
        {STATUSES.map((status) => (
          <RadioGroup.Item
            key={status}
            value={status}
            className={clsx(
              "cursor-pointer rounded font-medium whitespace-nowrap transition-colors",
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
        <p role="alert" className="mt-1 text-xs text-ink">
          <WarningCircleIcon
            size={14}
            aria-hidden
            className="mr-1 inline align-text-bottom text-ink-muted"
          />
          {error}
        </p>
      )}
    </div>
  );
}
