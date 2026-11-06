import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_TONE } from "@/lib/dashboard/labels";
import type { Priority } from "@/lib/triage/schema";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority]}>
      {priority === "Emergency" && <WarningIcon size={14} weight="bold" aria-hidden />}
      {priority === "Low" && (
        <span aria-hidden className="inline-block size-1.5 rounded-full bg-ink-muted" />
      )}
      {priority}
    </Badge>
  );
}
