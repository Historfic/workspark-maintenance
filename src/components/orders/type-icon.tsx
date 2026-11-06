import type { Icon } from "@phosphor-icons/react";
import {
  BugIcon,
  DropIcon,
  FireIcon,
  HouseIcon,
  LightningIcon,
  PlugIcon,
  QuestionIcon,
  ThermometerIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { IssueType } from "@/lib/triage/schema";

const ICON: Record<IssueType, Icon> = {
  Plumbing: DropIcon,
  Electrical: LightningIcon,
  HVAC: ThermometerIcon,
  Appliance: PlugIcon,
  Gas: FireIcon,
  Structural: HouseIcon,
  Pest: BugIcon,
  Other: QuestionIcon,
};

export function TypeIcon({ type }: { type: IssueType }) {
  const Component = ICON[type];
  return (
    <span
      aria-hidden
      className="inline-flex size-7 shrink-0 items-center justify-center rounded border border-line bg-bg"
    >
      <Component size={16} className="text-ink-muted" />
    </span>
  );
}
