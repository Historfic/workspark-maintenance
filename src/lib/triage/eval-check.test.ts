import { describe, expect, it } from "vitest";
import { makeExtraction, makeIssue, scriptedExtractor } from "@/test/fixtures";
import { checkSample } from "./eval-check";
import { runTriage } from "./pipeline";
import { SAMPLE_REPORTS } from "./samples";
import type { MissingField } from "./schema";
import type { TriageResult } from "./types";

function sample(id: string) {
  const found = SAMPLE_REPORTS.find((report) => report.id === id);
  if (!found) throw new Error(`No sample report ${id}`);
  return found;
}

async function noHeatResult(missingFields: MissingField[]): Promise<TriageResult> {
  const { extract } = scriptedExtractor([
    makeExtraction([
      makeIssue({
        issue_type: "HVAC",
        priority: "High",
        priority_rationale: "No heat in freezing weather.",
        unit: null,
        area: null,
        summary: "Heat is not working.",
        source_quote: "the heat isn't working in my place",
      }),
    ]),
  ]);
  const result = await runTriage(
    { text: sample("r2").text, source: "text", callerLast4: null, vapiCallId: null },
    extract,
  );
  return {
    ...result,
    tickets: result.tickets.map((ticket) => ({
      ...ticket,
      missing_fields: missingFields,
      needs_followup: true,
    })),
  };
}

describe("checkSample", () => {
  it("passes report 2 when the follow-up names the missing unit", async () => {
    expect(checkSample(sample("r2"), await noHeatResult(["unit_number"]))).toEqual([]);
  });

  it("fails report 2 when follow-up is set but unit_number is not among the missing fields", async () => {
    expect(checkSample(sample("r2"), await noHeatResult(["issue_detail"]))).toEqual([
      "HVAC missing_fields lacks unit_number",
    ]);
  });
});
