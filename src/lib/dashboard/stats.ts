import type { WorkOrderRow } from "@/lib/db/types";
import { PRIORITIES, type Priority } from "@/lib/triage/schema";

const DAY_MS = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

export interface PrioritySlice {
  priority: Priority;
  count: number;
}

export interface DayBucket {
  day: string;
  label: string;
  count: number;
}

export function openByPriority(rows: readonly WorkOrderRow[]): PrioritySlice[] {
  const counts = new Map<Priority, number>();
  for (const row of rows) {
    if (row.status !== "Done") counts.set(row.priority, (counts.get(row.priority) ?? 0) + 1);
  }
  return [...PRIORITIES]
    .reverse()
    .map((priority) => ({ priority, count: counts.get(priority) ?? 0 }));
}

export function dailyIntake(rows: readonly WorkOrderRow[], now: Date, days = 7): DayBucket[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const buckets: DayBucket[] = Array.from({ length: days }, (_, index) => {
    const date = new Date(today - (days - 1 - index) * DAY_MS);
    return { day: date.toISOString().slice(0, 10), label: WEEKDAY.format(date), count: 0 };
  });
  const byDay = new Map(buckets.map((bucket) => [bucket.day, bucket]));
  for (const row of rows) {
    const time = Date.parse(row.created_at);
    if (Number.isNaN(time)) continue;
    const bucket = byDay.get(new Date(time).toISOString().slice(0, 10));
    if (bucket) bucket.count += 1;
  }
  return buckets;
}
