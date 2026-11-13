"use client";

import { clsx } from "clsx";
import { Badge } from "@/components/ui/badge";
import type { WorkOrderRow } from "@/lib/db/types";
import { rmTicketNumber } from "@/lib/demo/rent-manager";
import type { DemoSettings } from "@/lib/demo/settings";
import { relativeTime } from "@/lib/dashboard/time";
import type { Status } from "@/lib/triage/schema";
import { PriorityBadge } from "./priority-badge";
import { StatusControl } from "./status-control";
import { EscalationBadge } from "./escalation-badge";
import { TenantCell } from "./tenant-cell";
import { TypeIcon } from "./type-icon";

export function WorkOrderCard({
  order,
  recent,
  now,
  settings,
  onStatusChange,
  onOpen,
}: {
  order: WorkOrderRow;
  recent: boolean;
  now: Date;
  settings: DemoSettings;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  return (
    <li
      className={clsx(
        "bg-surface p-4",
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
        <TenantCell unit={order.unit} />
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
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-muted">{rmTicketNumber(order.id)}</span>
        <EscalationBadge order={order} settings={settings} now={now} />
      </div>
      <div className="mt-3">
        <StatusControl order={order} size="lg" onChange={onStatusChange} />
      </div>
    </li>
  );
}
