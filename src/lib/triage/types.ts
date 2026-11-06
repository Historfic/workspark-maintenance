import type {
  CallerUrgency,
  Extraction,
  GroundingNote,
  IssueType,
  MissingField,
  Priority,
  RuleName,
  Source,
} from "./schema";

export type PrioritySource = "model" | "fallback" | `rule:${RuleName}`;

export interface TriageInput {
  text: string;
  source: Source;
  callerLast4: string | null;
  vapiCallId: string | null;
}

export interface TicketDraft {
  position: number;
  issue_type: IssueType;
  priority: Priority;
  model_priority: Priority | null;
  priority_source: PrioritySource;
  priority_reason: string;
  model_rationale: string | null;
  unit: string | null;
  area: string | null;
  summary: string;
  source_quote: string | null;
  missing_fields: MissingField[];
  grounding_notes: GroundingNote[];
  needs_followup: boolean;
}

export interface ReportDraft {
  source: Source;
  raw_text: string;
  caller_last4: string | null;
  vapi_call_id: string | null;
  caller_stated_urgency: CallerUrgency | null;
  caller_urgency_quote: string | null;
  extraction_status: "ok" | "fallback";
  model: string | null;
  prompt_version: string;
  llm_output: Extraction | null;
  latency_ms: number | null;
  error: string | null;
}

export interface TriageResult {
  report: ReportDraft;
  tickets: TicketDraft[];
}

export interface ExtractorResult {
  output: Extraction;
  model: string;
  latencyMs: number;
}

export type Extractor = (input: { text: string; source: Source }) => Promise<ExtractorResult>;

export type ExtractionFailure = "api" | "refusal" | "truncated" | "invalid_output";

export class ExtractionError extends Error {
  readonly kind: ExtractionFailure;

  constructor(message: string, kind: ExtractionFailure) {
    super(message);
    this.name = "ExtractionError";
    this.kind = kind;
  }
}
