import { groundExtraction } from "./ground";
import { PROMPT_VERSION } from "./prompt";
import { applySafetyRules, strongestRule } from "./rules";
import { higherPriority, type Priority } from "./schema";
import {
  ExtractionError,
  type Extractor,
  type ExtractorResult,
  type ReportDraft,
  type TicketDraft,
  type TriageInput,
  type TriageResult,
} from "./types";

const MAX_ATTEMPTS = 2;

export const FALLBACK_SUMMARY = "Needs manual review: automatic extraction failed.";
const FALLBACK_PRIORITY: Priority = "High";
const FALLBACK_REASON =
  "Automatic extraction failed, so a person needs to read the original report.";

type ReportBase = Pick<
  ReportDraft,
  "source" | "raw_text" | "caller_last4" | "vapi_call_id" | "prompt_version"
>;

function reportBase(input: TriageInput): ReportBase {
  return {
    source: input.source,
    raw_text: input.text,
    caller_last4: input.callerLast4,
    vapi_call_id: input.vapiCallId,
    prompt_version: PROMPT_VERSION,
  };
}

function buildResult(input: TriageInput, extracted: ExtractorResult): TriageResult {
  const grounded = groundExtraction(extracted.output, input.text);
  // A lone issue owns the whole report, so a quote that stops short of the hazard word cannot
  // hide it. With several issues, a grounded quote keeps each issue's hazards to itself.
  const soleIssue = grounded.issues.length === 1;
  const tickets = grounded.issues.map((issue, position): TicketDraft => {
    const evidence = soleIssue ? input.text : (issue.source_quote ?? input.text);
    const outcome = applySafetyRules(
      { priority: issue.priority, rationale: issue.priority_rationale },
      `${evidence} ${issue.summary}`,
    );
    return {
      position,
      issue_type: issue.issue_type,
      priority: outcome.priority,
      model_priority: issue.priority,
      priority_source: outcome.source,
      priority_reason: outcome.reason,
      model_rationale: issue.priority_rationale,
      unit: issue.unit,
      area: issue.area,
      summary: issue.summary,
      source_quote: issue.source_quote,
      missing_fields: issue.missing_fields,
      grounding_notes: issue.grounding_notes,
      needs_followup: issue.missing_fields.length > 0,
    };
  });

  return {
    report: {
      ...reportBase(input),
      caller_stated_urgency: grounded.caller_stated_urgency,
      caller_urgency_quote: grounded.caller_urgency_quote,
      extraction_status: "ok",
      model: extracted.model,
      llm_output: extracted.output,
      latency_ms: extracted.latencyMs,
      error: null,
    },
    tickets,
  };
}

function buildFallback(input: TriageInput, error: ExtractionError | null): TriageResult {
  const rule = strongestRule(input.text);
  return {
    report: {
      ...reportBase(input),
      caller_stated_urgency: null,
      caller_urgency_quote: null,
      extraction_status: "fallback",
      model: null,
      llm_output: null,
      latency_ms: null,
      error: error?.message ?? "Extraction failed",
    },
    tickets: [
      {
        position: 0,
        issue_type: "Other",
        priority: rule === null ? FALLBACK_PRIORITY : higherPriority(FALLBACK_PRIORITY, rule.floor),
        model_priority: null,
        priority_source: rule === null ? "fallback" : `rule:${rule.name}`,
        priority_reason: rule === null ? FALLBACK_REASON : rule.reason,
        model_rationale: null,
        unit: null,
        area: null,
        summary: FALLBACK_SUMMARY,
        source_quote: null,
        missing_fields: ["unit_number", "issue_detail"],
        grounding_notes: [],
        needs_followup: true,
      },
    ],
  };
}

export async function runTriage(input: TriageInput, extract: Extractor): Promise<TriageResult> {
  let lastError: ExtractionError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return buildResult(input, await extract({ text: input.text, source: input.source }));
    } catch (error) {
      if (!(error instanceof ExtractionError)) throw error;
      lastError = error;
    }
  }
  return buildFallback(input, lastError);
}
