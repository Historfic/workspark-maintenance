import { PhoneOutgoingIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import type { WorkOrderRow } from "@/lib/db/types";
import { escalationStatus } from "@/lib/demo/escalation";
import type { DemoSettings } from "@/lib/demo/settings";

const LABEL = {
  calling_super: "Calling super",
  calling_backup: "Calling backup",
  answered: "Backup on the way",
} as const;

export function EscalationBadge({
  order,
  settings,
  now,
}: {
  order: WorkOrderRow;
  settings: DemoSettings;
  now: Date;
}) {
  if (order.priority !== "Emergency" || order.status === "Done") return null;
  const status = escalationStatus(order.created_at, settings, now);
  return (
    <Badge tone={status === "answered" ? "done" : "neutral"}>
      {status === "answered" ? (
        <CheckCircleIcon size={14} weight="fill" aria-hidden />
      ) : (
        <PhoneOutgoingIcon
          size={14}
          aria-hidden
          className="text-emergency motion-safe:animate-pulse"
        />
      )}
      {LABEL[status]}
    </Badge>
  );
}
