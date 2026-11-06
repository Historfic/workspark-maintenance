"use client";

import { WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/db/browser-client";
import { fetchReportBundle } from "@/lib/db/public-reads";
import type { ReportRow, WorkOrderRow } from "@/lib/db/types";
import {
  AuditTrail,
  MissingInfo,
  PriorityExplanation,
  RawOutput,
  ReportText,
  Section,
  Siblings,
} from "./drawer-sections";
import { PriorityBadge } from "./priority-badge";
import { UnitChip } from "./unit-chip";

type Loaded =
  | { kind: "ready"; report: ReportRow; siblings: WorkOrderRow[] }
  | { kind: "error"; message: string };
type Bundle = Loaded | { kind: "loading" };

export function OrderDrawer({
  order,
  onClose,
}: {
  order: WorkOrderRow | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{ key: string; result: Loaded } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The parent clears `order` to close; the sheet keeps the last ticket so it has content while
  // it slides out.
  const [shown, setShown] = useState(order);
  if (order && order !== shown) setShown(order);
  const reportId = order?.report_id ?? null;
  const key = `${reportId ?? ""}#${attempt}`;
  const bundle: Bundle =
    loaded !== null && loaded.key === key ? loaded.result : { kind: "loading" };

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    fetchReportBundle(getBrowserClient(), reportId)
      .then((result) => {
        if (cancelled) return;
        setLoaded({
          key,
          result: result
            ? { kind: "ready", ...result }
            : { kind: "error", message: "This report no longer exists." },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          result: {
            kind: "error",
            message: error instanceof Error ? error.message : "Could not load.",
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reportId, key]);

  return (
    <Dialog.Root open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/30 data-[state=open]:animate-[fade-in_200ms_ease-out] data-[state=closed]:animate-[fade-out_140ms_ease-in]" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-[0_0_0_1px_var(--color-line),-12px_0_32px_-16px_rgba(15,23,42,0.35)] data-[state=open]:animate-[slide-in_200ms_ease-out] data-[state=closed]:animate-[slide-out_140ms_ease-in]"
          aria-describedby={undefined}
        >
          {shown && (
            <>
              <header className="flex items-start justify-between gap-4 border-b border-line p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={shown.priority} />
                    <span className="text-sm text-ink-muted">{shown.issue_type}</span>
                    <UnitChip unit={shown.unit} />
                  </div>
                  <Dialog.Title className="mt-2 text-lg leading-snug font-semibold">
                    {shown.summary}
                  </Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm" aria-label="Close">
                    <XIcon size={20} aria-hidden />
                  </Button>
                </Dialog.Close>
              </header>
              <div className="space-y-4 p-5">
                {bundle.kind === "loading" && (
                  <div role="status" className="space-y-3">
                    <span className="sr-only">Loading report…</span>
                    <div className="h-4 w-3/4 animate-pulse rounded bg-bg" />
                    <div className="h-4 w-full animate-pulse rounded bg-bg" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-bg" />
                  </div>
                )}
                {bundle.kind === "error" && (
                  <div role="alert" className="rounded border border-line bg-bg p-3 text-sm">
                    <p className="flex items-center gap-2">
                      <WarningCircleIcon
                        size={18}
                        aria-hidden
                        className="shrink-0 text-ink-muted"
                      />
                      {bundle.message}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() => setAttempt((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {bundle.kind === "ready" && (
                  <>
                    <Section title="What the caller said">
                      <ReportText text={bundle.report.raw_text} quote={shown.source_quote} />
                    </Section>
                    <Section title="Priority">
                      <PriorityExplanation order={shown} report={bundle.report} />
                    </Section>
                    {(shown.missing_fields.length > 0 || shown.grounding_notes.length > 0) && (
                      <Section title="Follow-up and corrections">
                        <MissingInfo order={shown} />
                      </Section>
                    )}
                    <Section title="Other tickets from this report">
                      <Siblings siblings={bundle.siblings} currentId={shown.id} />
                    </Section>
                    <Section title="Audit trail">
                      <AuditTrail report={bundle.report} />
                      <div className="mt-3">
                        <RawOutput report={bundle.report} />
                      </div>
                    </Section>
                  </>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
