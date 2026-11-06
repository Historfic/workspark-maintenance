import type { Icon } from "@phosphor-icons/react";
import { BrainIcon, ShieldCheckIcon, SirenIcon } from "@phosphor-icons/react/dist/ssr";
import { clsx } from "clsx";

const STEPS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: BrainIcon,
    title: "Claude reads the report",
    body: "It splits the call into separate problems and quotes the caller’s own words.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Code checks the facts",
    body: "A unit or quote the caller never said is dropped, and the ticket is flagged for follow-up.",
  },
  {
    icon: SirenIcon,
    title: "Safety rules set the floor",
    body: "Gas, smoke, water near electrics and no heat in the cold are escalated, however calmly they’re reported.",
  },
];

export function TriageExplainer({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="triage-heading"
      className={clsx("rounded border border-line bg-surface p-4 shadow-card", className)}
    >
      <h2
        id="triage-heading"
        className="text-xs font-semibold tracking-wide text-ink-muted uppercase"
      >
        How triage works
      </h2>
      <ol className="mt-3 space-y-3">
        {STEPS.map(({ icon: StepIcon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded border border-line bg-bg"
            >
              <StepIcon size={18} className="text-ink-muted" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-ink-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
        Every ticket’s drawer shows which of these decided its priority.
      </p>
    </section>
  );
}
