import type { Priority } from "@/lib/triage/schema";
import { ENTRY_POLICIES, type EntryPolicy } from "./settings";

export interface BookingPlan {
  visits: string[];
  entry: string;
}

const WINDOWS = ["9am–12pm", "1–4pm"] as const;
const OPTIONS = 3;
const DAY_MS = 86_400_000;

function nextWeekdays(from: Date, count: number, timeZone?: string): string[] {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone });
  const days: string[] = [];
  for (let offset = 1; days.length < count; offset++) {
    const day = new Date(from.getTime() + offset * DAY_MS);
    if (!["Sat", "Sun"].includes(weekday.format(day))) days.push(label.format(day));
  }
  return days;
}

export function bookingPlan(
  priority: Priority,
  createdAt: string,
  policy: EntryPolicy,
  timeZone?: string,
): BookingPlan {
  if (priority === "Emergency") {
    return {
      visits: ["Now: the on-call super is dispatched"],
      entry:
        policy === "tenant_present"
          ? "Tenant must let the super in; the agent confirms they can."
          : "Super may enter now because it is an emergency.",
    };
  }
  const entry = `${ENTRY_POLICIES[policy]}. The agent asks for permission and entry instructions (pets, alarm, key).`;
  if (priority === "High") return { visits: ["Today, as soon as possible"], entry };
  const days = nextWeekdays(new Date(createdAt), Math.ceil(OPTIONS / WINDOWS.length), timeZone);
  const visits = days.flatMap((day) => WINDOWS.map((window) => `${day} · ${window}`));
  return { visits: visits.slice(0, OPTIONS), entry };
}
