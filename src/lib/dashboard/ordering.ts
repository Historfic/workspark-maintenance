import type { WorkOrderRow } from "@/lib/db/types";
import { priorityRank } from "@/lib/triage/schema";

export function sortWorkOrders(rows: readonly WorkOrderRow[]): WorkOrderRow[] {
  return [...rows].sort((a, b) => {
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
    if (byPriority !== 0) return byPriority;
    return b.created_at.localeCompare(a.created_at);
  });
}
