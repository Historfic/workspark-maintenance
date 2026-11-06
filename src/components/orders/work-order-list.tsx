"use client";

import { ClipboardTextIcon } from "@phosphor-icons/react/dist/ssr";
import type { WorkOrderRow } from "@/lib/db/types";
import { matchesFilter, type FilterKey } from "@/lib/dashboard/filters";
import type { Status } from "@/lib/triage/schema";
import { WorkOrderCard } from "./work-order-card";
import { WorkOrderTableRow } from "./work-order-row";

// Each fixed width fits the widest thing its column ever holds (the Emergency and "Unit unknown"
// badges, "Electrical" beside its chip, the three-segment status control, "yesterday"); the
// summary takes the rest, so nothing wraps inside a control and the summary is never squeezed
// below what is left.
const COLUMNS = [
  { label: "Priority", width: "w-[8.5rem]" },
  { label: "Type", width: "w-[8.5rem]" },
  { label: "Unit", width: "w-[8.5rem]" },
  { label: "Summary", width: "w-auto" },
  { label: "Status", width: "w-[13.5rem]" },
  { label: "Age", width: "w-[6.5rem]" },
] as const;

export function WorkOrderList({
  orders,
  recentIds,
  filter,
  now,
  onStatusChange,
  onOpen,
}: {
  orders: WorkOrderRow[];
  recentIds: string[];
  filter: FilterKey;
  now: Date;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const visible = orders.filter((order) => matchesFilter(order, filter));
  const siblingCounts = new Map<string, number>();
  for (const order of orders)
    siblingCounts.set(order.report_id, (siblingCounts.get(order.report_id) ?? 0) + 1);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-ink-muted">
        <ClipboardTextIcon size={40} aria-hidden className="text-ink-muted" />
        <p>
          {orders.length === 0
            ? "No work orders yet. Try a sample report."
            : "Nothing matches this filter."}
        </p>
      </div>
    );
  }

  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-[15px] lg:table">
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.label} className={column.width} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line bg-bg/60 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={column.label === "Age" ? "px-3 py-2.5 text-right" : "px-3 py-2.5"}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((order) => (
            <WorkOrderTableRow
              key={order.id}
              order={order}
              recent={recentIds.includes(order.id)}
              siblingCount={siblingCounts.get(order.report_id) ?? 1}
              now={now}
              onStatusChange={onStatusChange}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line lg:hidden">
        {visible.map((order) => (
          <WorkOrderCard
            key={order.id}
            order={order}
            recent={recentIds.includes(order.id)}
            now={now}
            onStatusChange={onStatusChange}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </>
  );
}
