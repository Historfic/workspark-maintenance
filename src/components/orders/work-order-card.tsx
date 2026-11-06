"use client";

import { clsx } from "clsx";
import { Badge } from "@/components/ui/badge";
import type { WorkOrderRow } from "@/lib/db/types";
import { relativeTime } from "@/lib/dashboard/time";
import type { Status } from "@/lib/triage/schema";
import { PriorityBadge } from "./priority-badge";
import { StatusControl } from "./status-control";
import { TypeIcon } from "./type-icon";
import { UnitChip } from "./unit-chip";

export function WorkOrderCard({
  order,
  recent,
  now,
  onStatusChange,
  onOpen,
}: {
  order: WorkOrderRow;
  recent: boolean;
  now: Date;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  return (
    <li
      className={clsx(
        "rounded border border-line bg-surface p-4",
        order.needs_followup && "border-l-[3px] border-l-followup-line",
        recent && "row-arrive",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <PriorityBadge priority={order.priority} />
        <time dateTime={order.created_at} className="font-mono text-xs text-ink-muted">
          {relativeTime(order.created_at, now)}
        </time>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <TypeIcon type={order.issue_type} />
        <span>{order.issue_type}</span>
        <span aria-hidden>·</span>
        <UnitChip unit={order.unit} />
        {order.needs_followup && order.unit !== null && (
          <Badge tone="followup">Needs follow-up</Badge>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="mt-2 block min-h-11 cursor-pointer text-left text-[15px] hover:text-accent"
      >
        {order.summary}
      </button>
      <div className="mt-3">
        <StatusControl order={order} size="lg" onChange={onStatusChange} />
      </div>
    </li>
  );
}
