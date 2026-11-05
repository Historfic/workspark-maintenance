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
