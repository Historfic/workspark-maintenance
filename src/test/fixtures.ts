import type { WorkOrderRow } from "@/lib/db/types";
import { SAMPLE_REPORTS } from "@/lib/triage/samples";
import type { ExtractedIssue, Extraction } from "@/lib/triage/schema";
import type { Extractor } from "@/lib/triage/types";

export function makeIssue(overrides: Partial<ExtractedIssue> = {}): ExtractedIssue {
  return {
    issue_type: "Plumbing",
    priority: "Medium",
    priority_rationale: "Impairs normal use of the kitchen.",
    summary: "Kitchen sink is clogged.",
    unit: "12C",
    area: "kitchen",
    source_quote: "The kitchen sink is clogged",
    missing_fields: [],
    ...overrides,
  };
}

export function makeExtraction(
  issues: ExtractedIssue[],
  overrides: Partial<Omit<Extraction, "issues">> = {},
): Extraction {
  return { caller_stated_urgency: "none_stated", caller_urgency_quote: null, issues, ...overrides };
}

export function sampleText(id: string): string {
  const sample = SAMPLE_REPORTS.find((report) => report.id === id);
  if (!sample) throw new Error(`No sample report ${id}`);
  return sample.text;
}

export function scriptedExtractor(steps: Array<Extraction | Error>): {
  extract: Extractor;
  callCount: () => number;
} {
  let calls = 0;
  const extract: Extractor = async () => {
    const step = steps[Math.min(calls, steps.length - 1)];
    calls += 1;
    if (step === undefined) throw new Error("scriptedExtractor needs at least one step");
    if (step instanceof Error) throw step;
    return { output: step, model: "claude-fable-5-1", latencyMs: 1234 };
  };
  return { extract, callCount: () => calls };
}

export function makeWorkOrderRow(overrides: Partial<WorkOrderRow> = {}): WorkOrderRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    report_id: "22222222-2222-4222-8222-222222222222",
    position: 0,
    issue_type: "Plumbing",
    priority: "Medium",
    model_priority: "Medium",
    priority_source: "model",
    priority_reason: "Impairs normal use of the kitchen.",
    model_rationale: "Impairs normal use of the kitchen.",
    unit: "12C",
    area: "kitchen",
    summary: "Kitchen sink is clogged.",
    source_quote: "The kitchen sink is clogged",
    missing_fields: [],
    grounding_notes: [],
    needs_followup: false,
    status: "New",
    created_at: "2026-11-06T10:00:00.000Z",
    updated_at: "2026-11-06T10:00:00.000Z",
    ...overrides,
  };
}
