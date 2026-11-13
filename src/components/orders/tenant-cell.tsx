import { Badge } from "@/components/ui/badge";
import { findTenant } from "@/lib/demo/rent-manager";
import { UnitChip } from "./unit-chip";

export function TenantCell({ unit }: { unit: string | null }) {
  const tenant = findTenant(unit);
  if (unit === null) return <UnitChip unit={null} />;
  if (!tenant) {
    return (
      <span className="flex flex-col items-start gap-1">
        <UnitChip unit={unit} />
        <Badge tone="followup">No tenant match</Badge>
      </span>
    );
  }
  return (
    <span className="block min-w-0">
      <span className="block truncate">{tenant.name}</span>
      <span className="block font-mono text-xs text-ink-muted">Unit {tenant.unit}</span>
    </span>
  );
}
