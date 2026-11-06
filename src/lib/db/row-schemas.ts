import { z } from "zod";
import {
  CALLER_URGENCIES,
  GROUNDING_NOTES,
  ISSUE_TYPES,
  MISSING_FIELDS,
  PRIORITIES,
  RULE_NAMES,
  SOURCES,
  STATUSES,
  extractionSchema,
} from "@/lib/triage/schema";
import type { ReportRow, WorkOrderRow } from "./types";

const prioritySource = z.union([
  z.literal("model"),
  z.literal("fallback"),
  ...RULE_NAMES.map((name) => z.literal(`rule:${name}` as const)),
]);

export const workOrderRowSchema: z.ZodType<WorkOrderRow> = z.object({
  id: z.uuid(),
  report_id: z.uuid(),
  position: z.number().int(),
  issue_type: z.enum(ISSUE_TYPES),
  priority: z.enum(PRIORITIES),
  model_priority: z.enum(PRIORITIES).nullable(),
  priority_source: prioritySource,
  priority_reason: z.string(),
  model_rationale: z.string().nullable(),
  unit: z.string().nullable(),
  area: z.string().nullable(),
  summary: z.string(),
  source_quote: z.string().nullable(),
  missing_fields: z.array(z.enum(MISSING_FIELDS)),
  grounding_notes: z.array(z.enum(GROUNDING_NOTES)),
  needs_followup: z.boolean(),
  status: z.enum(STATUSES),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reportRowSchema: z.ZodType<ReportRow> = z.object({
  id: z.uuid(),
  created_at: z.string(),
  source: z.enum(SOURCES),
  raw_text: z.string(),
  caller_last4: z.string().nullable(),
  vapi_call_id: z.string().nullable(),
  caller_stated_urgency: z.enum(CALLER_URGENCIES).nullable(),
  caller_urgency_quote: z.string().nullable(),
  extraction_status: z.enum(["ok", "fallback"]),
  model: z.string().nullable(),
  prompt_version: z.string(),
  llm_output: extractionSchema.nullable(),
  latency_ms: z.number().int().nullable(),
  error: z.string().nullable(),
});

export function parseWorkOrderRow(input: unknown): WorkOrderRow | null {
  const result = workOrderRowSchema.safeParse(input);
  return result.success ? result.data : null;
}
