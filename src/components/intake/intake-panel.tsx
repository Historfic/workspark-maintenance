"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseWorkOrderRow } from "@/lib/db/row-schemas";
import type { WorkOrderRow } from "@/lib/db/types";
import { MAX_REPORT_CHARS } from "@/lib/triage/normalize";
import { IntakeResult } from "./intake-result";
import { SampleChips } from "./sample-chips";

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; orders: WorkOrderRow[] }
  | { kind: "error"; message: string };

const apiBodySchema = z.object({
  error: z.object({ message: z.string().optional() }).optional(),
  work_orders: z.array(z.unknown()).optional(),
});

async function submitReport(text: string): Promise<WorkOrderRow[]> {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiBodySchema.safeParse(body);
  if (!response.ok) {
    throw new Error(parsed.data?.error?.message ?? `The server answered ${response.status}.`);
  }
  return (parsed.data?.work_orders ?? []).flatMap((item) => {
    const row = parseWorkOrderRow(item);
    return row ? [row] : [];
  });
}

export function IntakePanel({ onCreated }: { onCreated: (orders: WorkOrderRow[]) => void }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = phase.kind === "submitting";
  const remaining = MAX_REPORT_CHARS - text.length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || text.trim().length === 0) return;
    setPhase({ kind: "submitting" });
    try {
      const orders = await submitReport(text);
      onCreated(orders);
      setPhase({ kind: "done", orders });
      setText("");
    } catch (error) {
      setPhase({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  function tryAgain() {
    setPhase({ kind: "idle" });
    textareaRef.current?.focus();
  }

  return (
    <section aria-labelledby="intake-heading" className="rounded border border-line bg-surface p-4">
      <h2
        id="intake-heading"
        className="text-xs font-semibold tracking-wide text-ink-muted uppercase"
      >
        New report
      </h2>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="report-text" className="block text-sm font-medium">
            What did the caller say?
          </label>
          <Textarea
            ref={textareaRef}
            id="report-text"
            name="text"
            rows={5}
            maxLength={MAX_REPORT_CHARS}
            value={text}
            readOnly={busy}
            onChange={(event) => setText(event.target.value)}
            placeholder="Hi, this is apartment 4B. There's water coming through the ceiling…"
            aria-describedby="report-help"
            className="mt-1"
          />
          <p id="report-help" className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>Paste or type the report as the tenant said it.</span>
            <span className="font-mono">{remaining}</span>
          </p>
        </div>
        <Button type="submit" disabled={busy || text.trim().length === 0} className="w-full">
          {busy ? "Reading report…" : "Submit report"}
        </Button>
      </form>
      <div className="mt-4">
        <p className="mb-2 text-xs text-ink-muted">Try one of the sample reports</p>
        <SampleChips disabled={busy} onPick={(sample) => setText(sample)} />
      </div>
      <div role="status" aria-live="polite" className="mt-4 min-h-6">
        {phase.kind === "done" && <IntakeResult orders={phase.orders} />}
      </div>
      {phase.kind === "error" && (
        <div role="alert" className="mt-4 rounded border border-line bg-surface p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <WarningCircleIcon size={18} aria-hidden className="text-ink-muted" />
            Couldn’t create the ticket
          </p>
          <p className="mt-1 text-ink-muted">{phase.message}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={tryAgain}>
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}
