import type { SampleReport } from "./samples";
import type { TriageResult } from "./types";

export interface SampleOutcome {
  sample: SampleReport;
  result: TriageResult;
  failures: string[];
}

export function checkSample(sample: SampleReport, result: TriageResult): string[] {
  const failures: string[] = [];
  if (result.report.extraction_status !== "ok") {
    failures.push(`extraction fell back (${result.report.error ?? "unknown error"})`);
  }
  if (result.tickets.length !== sample.expected.length) {
    failures.push(`expected ${sample.expected.length} ticket(s), got ${result.tickets.length}`);
  }

  const unmatched = [...result.tickets];
  for (const want of sample.expected) {
    const index = unmatched.findIndex((ticket) => ticket.issue_type === want.issue_type);
    const got = index === -1 ? undefined : unmatched.splice(index, 1)[0];
    if (!got) {
      failures.push(`no ${want.issue_type} ticket`);
      continue;
    }
    if (!want.priorities.includes(got.priority)) {
      failures.push(
        `${want.issue_type} priority ${got.priority}, expected ${want.priorities.join(" or ")}`,
      );
    }
    if (got.unit !== want.unit) {
      failures.push(
        `${want.issue_type} unit ${got.unit ?? "null"}, expected ${want.unit ?? "null"}`,
      );
    }
    if (got.needs_followup !== want.needs_followup) {
      failures.push(`${want.issue_type} needs_followup ${String(got.needs_followup)}`);
    }
    if (want.unit === null && !got.missing_fields.includes("unit_number")) {
      failures.push(`${want.issue_type} missing_fields lacks unit_number`);
    }
    if (want.priority_source && got.priority_source !== want.priority_source) {
      failures.push(
        `${want.issue_type} priority source ${got.priority_source}, expected ${want.priority_source}`,
      );
    }
  }
  return failures;
}

export function renderResultsTable(outcomes: SampleOutcome[]): string {
  const header = [
    "| # | Report | Tickets | Type → priority (decided by) | Unit | Follow-up | Latency | Result |",
    "|---|---|---|---|---|---|---|---|",
  ];
  const rows = outcomes.map(({ sample, result, failures }, index) => {
    const join = (values: string[]) => values.join("<br>");
    const types = join(
      result.tickets.map((t) => `${t.issue_type} → **${t.priority}** (${t.priority_source})`),
    );
    const units = join(result.tickets.map((t) => t.unit ?? "—"));
    const followUps = join(
      result.tickets.map((t) => (t.needs_followup ? `yes: ${t.missing_fields.join(", ")}` : "no")),
    );
    const latency =
      result.report.latency_ms === null ? "—" : `${(result.report.latency_ms / 1000).toFixed(1)} s`;
    const verdict =
      failures.length === 0 ? "pass" : `FAIL: ${failures.join("; ")}`.replace(/\|/g, "\\|");
    return `| ${index + 1} | ${sample.label} | ${result.tickets.length} | ${types} | ${units} | ${followUps} | ${latency} | ${verdict} |`;
  });
  return [...header, ...rows].join("\n");
}
