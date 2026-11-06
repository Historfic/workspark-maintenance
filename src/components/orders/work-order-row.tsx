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

const CELL = "px-3 py-3.5";

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
        "border-b border-line bg-surface align-top last:border-b-0",
        order.needs_followup && "border-l-[3px] border-l-followup-line",
        recent && "row-arrive",
      )}
    >
      <td className={CELL}>
        <PriorityBadge priority={order.priority} />
      </td>
      <td className={CELL}>
        <span className="flex items-center gap-2">
          <TypeIcon type={order.issue_type} />
          <span className="truncate">{order.issue_type}</span>
        </span>
      </td>
      <td className={CELL}>
        <UnitChip unit={order.unit} />
      </td>
      <td className={CELL}>
        <button
          type="button"
          onClick={() => onOpen(order.id)}
          className="block w-full cursor-pointer text-left hover:text-accent hover:underline"
        >
          <span className="line-clamp-2">{order.summary}</span>
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
      <td className={CELL}>
        <StatusControl order={order} onChange={onStatusChange} />
      </td>
      <td
        className={clsx(
          CELL,
          "text-right font-mono text-sm text-ink-muted tabular-nums whitespace-nowrap",
        )}
      >
        <time dateTime={order.created_at}>{relativeTime(order.created_at, now)}</time>
      </td>
    </tr>
  );
}
