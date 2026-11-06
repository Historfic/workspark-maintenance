import type { ReactNode } from "react";
import type { ReportRow, WorkOrderRow } from "@/lib/db/types";
import { quoteRange } from "@/lib/dashboard/highlight";
import { prioritySourceLabel, SOURCE_LABEL } from "@/lib/dashboard/labels";
import type { CallerUrgency } from "@/lib/triage/schema";
import { PriorityBadge } from "./priority-badge";

const URGENCY_LABEL: Record<CallerUrgency, string> = {
  none_stated: "nothing about urgency",
  low: "not urgent",
  medium: "fairly urgent",
  high: "urgent",
  emergency: "an emergency",
};

const MISSING_LABEL: Record<string, string> = {
  unit_number: "Unit number not given — follow up with the caller.",
  issue_detail: "Problem too vague to dispatch — follow up with the caller.",
  unit_not_in_report: "The model suggested a unit the report never mentions; it was discarded.",
  quote_not_in_report: "The model's quote was not verbatim; the whole report was used instead.",
};

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}

export function ReportText({ text, quote }: { text: string; quote: string | null }) {
  const range = quoteRange(text, quote);
  if (!range) return <p className="whitespace-pre-wrap">{text}</p>;
  return (
    <p className="whitespace-pre-wrap">
      {text.slice(0, range.start)}
      <mark className="rounded-sm bg-accent/15 px-0.5 text-ink">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </p>
  );
}

export function PriorityExplanation({ order, report }: { order: WorkOrderRow; report: ReportRow }) {
  const escalated = order.model_priority !== null && order.model_priority !== order.priority;
  return (
    <dl className="space-y-2">
      <div className="flex items-center gap-2">
        <dt className="w-28 text-ink-muted">Assessed</dt>
        <dd className="flex items-center gap-2">
          <PriorityBadge priority={order.priority} />
          <span className="text-ink-muted">{prioritySourceLabel(order.priority_source)}</span>
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-28 shrink-0 text-ink-muted">Why</dt>
        <dd>{order.priority_reason}</dd>
      </div>
      {escalated && order.model_rationale && (
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-muted">Model said</dt>
          <dd>
            {order.model_priority}: {order.model_rationale}
          </dd>
        </div>
      )}
      {report.caller_stated_urgency && report.caller_stated_urgency !== "none_stated" && (
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-muted">Caller said</dt>
          <dd>
            {report.caller_urgency_quote ? (
              <q>{report.caller_urgency_quote}</q>
            ) : (
              URGENCY_LABEL[report.caller_stated_urgency]
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

export function MissingInfo({ order }: { order: WorkOrderRow }) {
  if (order.missing_fields.length === 0 && order.grounding_notes.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {[...order.missing_fields, ...order.grounding_notes].map((key) => (
        <li key={key}>{MISSING_LABEL[key] ?? key}</li>
      ))}
    </ul>
  );
}

export function Siblings({ siblings, currentId }: { siblings: WorkOrderRow[]; currentId: string }) {
  const others = siblings.filter((row) => row.id !== currentId);
  if (others.length === 0)
    return <p className="text-ink-muted">This is the only ticket from this report.</p>;
  return (
    <ul className="space-y-1.5">
      {others.map((row) => (
        <li key={row.id} className="flex items-center gap-2">
          <PriorityBadge priority={row.priority} />
          <span>{row.issue_type}</span>
          <span className="text-ink-muted">— {row.summary}</span>
        </li>
      ))}
    </ul>
  );
}

export function AuditTrail({ report }: { report: ReportRow }) {
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-y-1 font-mono text-xs text-ink-muted">
      <dt>Source</dt>
      <dd>
        {SOURCE_LABEL[report.source]}
        {report.caller_last4 ? ` · caller …${report.caller_last4}` : ""}
      </dd>
      <dt>Model</dt>
      <dd>{report.model ?? "—"}</dd>
      <dt>Prompt</dt>
      <dd>{report.prompt_version}</dd>
      <dt>Latency</dt>
      <dd>{report.latency_ms === null ? "—" : `${(report.latency_ms / 1000).toFixed(1)} s`}</dd>
      <dt>Extraction</dt>
      <dd>
        {report.extraction_status === "ok" ? "ok" : `fallback — ${report.error ?? "unknown error"}`}
      </dd>
    </dl>
  );
}

export function RawOutput({ report }: { report: ReportRow }) {
  if (!report.llm_output) return null;
  return (
    <details>
      <summary className="cursor-pointer text-sm text-accent">Show the model’s raw output</summary>
      <pre className="mt-2 max-h-72 overflow-auto rounded border border-line bg-bg p-3 font-mono text-xs leading-5">
        {JSON.stringify(report.llm_output, null, 2)}
      </pre>
    </details>
  );
}
