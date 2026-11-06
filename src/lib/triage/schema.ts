import { z } from "zod";

export const ISSUE_TYPES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Gas",
  "Structural",
  "Pest",
  "Other",
] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Emergency"] as const;
export const STATUSES = ["New", "In Progress", "Done"] as const;
export const SOURCES = ["text", "phone", "web_call"] as const;
export const CALLER_URGENCIES = ["none_stated", "low", "medium", "high", "emergency"] as const;
export const MISSING_FIELDS = ["unit_number", "issue_detail"] as const;
export const RULE_NAMES = [
  "gas_odor",
  "water_electrical",
  "fire_smoke",
  "flooding",
  "no_heat_cold",
] as const;
export const GROUNDING_NOTES = ["unit_not_in_report", "quote_not_in_report"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type CallerUrgency = (typeof CALLER_URGENCIES)[number];
export type MissingField = (typeof MISSING_FIELDS)[number];
export type RuleName = (typeof RULE_NAMES)[number];
export type GroundingNote = (typeof GROUNDING_NOTES)[number];

export const extractedIssueSchema = z.strictObject({
  issue_type: z.enum(ISSUE_TYPES),
  priority: z.enum(PRIORITIES),
  priority_rationale: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(20).nullable(),
  area: z.string().trim().max(80).nullable(),
  source_quote: z.string().trim().min(1).max(600),
  missing_fields: z.array(z.enum(MISSING_FIELDS)),
});

export const extractionSchema = z.strictObject({
  caller_stated_urgency: z.enum(CALLER_URGENCIES),
  caller_urgency_quote: z.string().trim().max(300).nullable(),
  issues: z.array(extractedIssueSchema).min(1).max(5),
});

export type ExtractedIssue = z.infer<typeof extractedIssueSchema>;
export type Extraction = z.infer<typeof extractionSchema>;

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

// Hand-written because structured outputs reject length and count keywords; Zod enforces those.
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["caller_stated_urgency", "caller_urgency_quote", "issues"],
  properties: {
    caller_stated_urgency: { type: "string", enum: [...CALLER_URGENCIES] },
    caller_urgency_quote: nullableString,
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "issue_type",
          "priority",
          "priority_rationale",
          "summary",
          "unit",
          "area",
          "source_quote",
          "missing_fields",
        ],
        properties: {
          issue_type: { type: "string", enum: [...ISSUE_TYPES] },
          priority: { type: "string", enum: [...PRIORITIES] },
          priority_rationale: { type: "string" },
          summary: { type: "string" },
          unit: nullableString,
          area: nullableString,
          source_quote: { type: "string" },
          missing_fields: { type: "array", items: { type: "string", enum: [...MISSING_FIELDS] } },
        },
      },
    },
  },
} as const;

const PRIORITY_RANK: Record<Priority, number> = { Low: 0, Medium: 1, High: 2, Emergency: 3 };

export function priorityRank(priority: Priority): number {
  return PRIORITY_RANK[priority];
}

export function higherPriority(a: Priority, b: Priority): Priority {
  return PRIORITY_RANK[b] > PRIORITY_RANK[a] ? b : a;
}
