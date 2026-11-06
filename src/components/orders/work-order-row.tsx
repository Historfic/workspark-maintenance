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

export function WorkOrderTableRow({
  order,
  recent,
  siblingCount,
  now,
  onStatusChange,
  onOpen,
}: {
  order: WorkOrderRow;
  recent: boolean;
  siblingCount: number;
  now: Date;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  return (
    <tr
      className={clsx(
        "border-b border-line bg-surface align-top",
        order.needs_followup && "border-l-[3px] border-l-followup-line",
        recent && "row-arrive",
      )}
    >
      <td className="px-3 py-3">
        <PriorityBadge priority={order.priority} />
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-2">
          <TypeIcon type={order.issue_type} />
          {order.issue_type}
        </span>
      </td>
      <td className="px-3 py-3">
        <UnitChip unit={order.unit} />
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => onOpen(order.id)}
          className="cursor-pointer text-left hover:text-accent hover:underline"
        >
          {order.summary}
        </button>
        {siblingCount > 1 && (
          <span className="mt-1 block text-xs text-ink-muted">
            {order.position + 1} of {siblingCount} from this report
          </span>
        )}
        {order.needs_followup && order.unit !== null && (
          <Badge tone="followup" className="mt-1.5">
            Needs follow-up
          </Badge>
        )}
      </td>
      <td className="px-3 py-3">
        <StatusControl order={order} onChange={onStatusChange} />
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm text-ink-muted tabular-nums whitespace-nowrap">
        <time dateTime={order.created_at}>{relativeTime(order.created_at, now)}</time>
      </td>
    </tr>
  );
}
