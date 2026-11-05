import {
  MISSING_FIELDS,
  type CallerUrgency,
  type ExtractedIssue,
  type Extraction,
  type GroundingNote,
  type MissingField,
} from "./schema";

export interface GroundedIssue extends Omit<ExtractedIssue, "unit" | "source_quote"> {
  unit: string | null;
  source_quote: string | null;
  grounding_notes: GroundingNote[];
}

export interface GroundedExtraction {
  caller_stated_urgency: CallerUrgency;
  caller_urgency_quote: string | null;
  issues: GroundedIssue[];
}

const UNIT_PREFIX = /^(UNIT|APARTMENT|APT|SUITE|STE)\b\.?/;

export function normalizeUnit(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/#/g, " ")
    .trim()
    .replace(UNIT_PREFIX, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function unitAppearsIn(unit: string, report: string): boolean {
  const target = normalizeUnit(unit);
  if (target.length === 0) return false;
  const tokens = report.toUpperCase().match(/[A-Z0-9]+(?:-[A-Z0-9]+)?/g) ?? [];
  return tokens.some((token) => token.replace(/-/g, "") === target);
}

function canonical(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function trimEdgePunctuation(text: string): string {
  return text.replace(/^[\s"'.,!?;:]+|[\s"'.,!?;:]+$/g, "");
}

export function quoteAppearsIn(quote: string, report: string): boolean {
  const needle = trimEdgePunctuation(canonical(quote));
  return needle.length > 0 && canonical(report).includes(needle);
}

function groundIssue(issue: ExtractedIssue, report: string): GroundedIssue {
  const notes: GroundingNote[] = [];
  const statedUnit = issue.unit !== null && issue.unit.length > 0 ? issue.unit : null;
  const unitIsGrounded = statedUnit !== null && unitAppearsIn(statedUnit, report);
  if (statedUnit !== null && !unitIsGrounded) notes.push("unit_not_in_report");

  const quoteIsGrounded = quoteAppearsIn(issue.source_quote, report);
  if (!quoteIsGrounded) notes.push("quote_not_in_report");

  const missing = new Set<MissingField>(issue.missing_fields);
  if (unitIsGrounded) missing.delete("unit_number");
  else missing.add("unit_number");

  return {
    ...issue,
    unit: unitIsGrounded && statedUnit !== null ? normalizeUnit(statedUnit) : null,
    source_quote: quoteIsGrounded ? issue.source_quote : null,
    missing_fields: MISSING_FIELDS.filter((field) => missing.has(field)),
    grounding_notes: notes,
  };
}

export function groundExtraction(extraction: Extraction, report: string): GroundedExtraction {
  const urgencyQuote = extraction.caller_urgency_quote;
  return {
    caller_stated_urgency: extraction.caller_stated_urgency,
    caller_urgency_quote:
      urgencyQuote !== null && quoteAppearsIn(urgencyQuote, report) ? urgencyQuote : null,
    issues: extraction.issues.map((issue) => groundIssue(issue, report)),
  };
}
