import { Badge } from "@/components/ui/badge";

export function UnitChip({ unit }: { unit: string | null }) {
  if (unit === null) return <Badge tone="followup">Unit unknown</Badge>;
  return <span className="font-mono text-[15px]">{unit}</span>;
}
