import type { WorkOrderRow } from "@/lib/db/types";

export type FilterKey = "all" | "emergency" | "followup" | "new" | "in_progress" | "done";

export const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "emergency", label: "Emergency" },
  { key: "followup", label: "Needs follow-up" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export function matchesFilter(row: WorkOrderRow, key: FilterKey): boolean {
  switch (key) {
    case "all":
      return true;
    case "emergency":
      return row.priority === "Emergency";
    case "followup":
      return row.needs_followup;
    case "new":
      return row.status === "New";
    case "in_progress":
      return row.status === "In Progress";
    case "done":
      return row.status === "Done";
  }
}

export function countFilters(rows: readonly WorkOrderRow[]): Record<FilterKey, number> {
  const counts: Record<FilterKey, number> = {
    all: 0,
    emergency: 0,
    followup: 0,
    new: 0,
    in_progress: 0,
    done: 0,
  };
  for (const row of rows) {
    for (const { key } of FILTERS) if (matchesFilter(row, key)) counts[key] += 1;
  }
  return counts;
}
