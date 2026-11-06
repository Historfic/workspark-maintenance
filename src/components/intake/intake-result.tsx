import type { WorkOrderRow } from "@/lib/db/types";
import { PriorityBadge } from "@/components/orders/priority-badge";

export function IntakeResult({ orders }: { orders: WorkOrderRow[] }) {
  return (
    <div role="status" className="rounded border border-line bg-bg p-3 text-sm">
      <p className="font-medium">
        Created {orders.length} ticket{orders.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 space-y-1.5">
        {orders.map((order) => (
          <li key={order.id} className="flex items-center gap-2">
            <PriorityBadge priority={order.priority} />
            <span>{order.issue_type}</span>
            <span className="font-mono text-ink-muted">{order.unit ?? "unit unknown"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
