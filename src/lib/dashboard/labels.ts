import type { BadgeTone } from "@/components/ui/badge";
import type { Priority, Source, Status } from "@/lib/triage/schema";
import type { PrioritySource } from "@/lib/triage/types";

export const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  Emergency: "emergency",
  High: "ink",
  Medium: "outline",
  Low: "muted",
};

export const STATUS_LABEL: Record<Status, string> = {
  New: "New",
  "In Progress": "In progress",
  Done: "Done",
};

export const SOURCE_LABEL: Record<Source, string> = {
  text: "Message (SMS or email)",
  phone: "Phone call",
  web_call: "Browser call",
};

export function prioritySourceLabel(source: PrioritySource): string {
  if (source === "model") return "Model";
  if (source === "fallback") return "Manual review";
  return `Rule: ${source.slice("rule:".length).replace(/_/g, " ")}`;
}
