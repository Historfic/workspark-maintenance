"use client";

import type { WorkOrderRow } from "@/lib/db/types";
import { matchesFilter, type FilterKey } from "@/lib/dashboard/filters";
import type { Status } from "@/lib/triage/schema";
import { WorkOrderCard } from "./work-order-card";
import { WorkOrderTableRow } from "./work-order-row";

const HEADERS = ["Priority", "Type", "Unit", "Summary", "Status", "Age"] as const;

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
      <p className="rounded border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-muted">
        {orders.length === 0
          ? "No work orders yet. Try a sample report."
          : "Nothing matches this filter."}
      </p>
    );
  }

  return (
    <>
      <table className="hidden w-full border-collapse text-[15px] md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {HEADERS.map((header) => (
              <th
                key={header}
                scope="col"
                className={header === "Age" ? "px-3 py-2 text-right" : "px-3 py-2"}
              >
                {header}
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
      <ul className="space-y-3 md:hidden">
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
