import { describe, expect, it } from "vitest";
import { makeExtraction, makeIssue, sampleText, scriptedExtractor } from "@/test/fixtures";
import { runTriage } from "./pipeline";
import { PROMPT_VERSION } from "./prompt";
import { ExtractionError } from "./types";

const input = (id: string) => ({
  text: sampleText(id),
  source: "text" as const,
  callerLast4: null,
  vapiCallId: null,
});

describe("runTriage", () => {
  it("creates one ticket per issue, in order, for a two-problem report", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction([
        makeIssue(),
        makeIssue({
          issue_type: "Electrical",
          priority: "Low",
          priority_rationale: "Minor, no safety risk reported.",
          summary: "Hallway light outside the unit flickers.",
          area: "hallway outside the unit",
          source_quote: "the hallway light outside my door has been flickering for a week",
        }),
      ]),
    ]);
    const { report, tickets } = await runTriage(input("r3"), extract);
    expect(report.extraction_status).toBe("ok");
    expect(tickets.map((t) => [t.position, t.issue_type, t.unit, t.priority])).toEqual([
      [0, "Plumbing", "12C", "Medium"],
      [1, "Electrical", "12C", "Low"],
    ]);
  });

  it("lets a safety rule overrule a calm model and keeps both views", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction(
        [
          makeIssue({
            issue_type: "Gas",
            priority: "Medium",
            priority_rationale: "Caller is unsure it is serious.",
            unit: "7A",
            area: "kitchen, near the stove",
            summary: "Caller noticed an odd smell near the stove.",
            source_quote: "there's kind of a weird smell near the stove, like maybe gas",
          }),
        ],
        {
          caller_stated_urgency: "low",
          caller_urgency_quote: "My neighbor said it's probably nothing",
        },
      ),
    ]);
    const { report, tickets } = await runTriage(input("r4"), extract);
    expect(tickets[0]).toMatchObject({
      priority: "Emergency",
      model_priority: "Medium",
      priority_source: "rule:gas_odor",
      model_rationale: "Caller is unsure it is serious.",
    });
    expect(report.caller_urgency_quote).toBe("My neighbor said it's probably nothing");
  });

  it("drops an invented unit and flags the ticket for follow-up", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction([
        makeIssue({
          issue_type: "HVAC",
          priority: "High",
          priority_rationale: "No heat in freezing weather.",
          unit: "3A",
          area: null,
          summary: "Heat is not working.",
          source_quote: "the heat isn't working in my place",
        }),
      ]),
    ]);
    const { tickets } = await runTriage(input("r2"), extract);
    expect(tickets[0]).toMatchObject({
      unit: null,
      needs_followup: true,
      missing_fields: ["unit_number"],
      grounding_notes: ["unit_not_in_report"],
    });
  });

  it("checks rules against the whole report when the quote is not grounded", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction([
        makeIssue({
          unit: "4B",
          priority: "High",
          priority_rationale: "Active leak.",
          area: "bathroom ceiling",
          summary: "Bathroom ceiling leak.",
          source_quote: "water is coming through the ceiling",
        }),
      ]),
    ]);
    const { tickets } = await runTriage(input("r1"), extract);
    expect(tickets[0]).toMatchObject({
      source_quote: null,
      priority: "Emergency",
      priority_source: "rule:water_electrical",
    });
  });

  it("retries once after an extraction failure", async () => {
    const { extract, callCount } = scriptedExtractor([
      new ExtractionError("timeout", "api"),
      makeExtraction([makeIssue()]),
    ]);
    const { report } = await runTriage(input("r3"), extract);
    expect(report.extraction_status).toBe("ok");
    expect(callCount()).toBe(2);
  });

  it("saves a manual-review ticket when extraction fails twice", async () => {
    const { extract, callCount } = scriptedExtractor([
      new ExtractionError("Model declined the request", "refusal"),
    ]);
    const { report, tickets } = await runTriage(input("r5"), extract);
    expect(callCount()).toBe(2);
    expect(report).toMatchObject({
      extraction_status: "fallback",
      error: "Model declined the request",
      raw_text: sampleText("r5"),
    });
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      issue_type: "Other",
      priority: "High",
      priority_source: "fallback",
      needs_followup: true,
    });
  });

  it("does not hide programming errors behind the fallback", async () => {
    const { extract } = scriptedExtractor([new TypeError("boom")]);
    await expect(runTriage(input("r5"), extract)).rejects.toThrow(TypeError);
  });

  it("records the audit trail on the report", async () => {
    const extraction = makeExtraction([makeIssue()]);
    const { extract } = scriptedExtractor([extraction]);
    const { report } = await runTriage(input("r3"), extract);
    expect(report).toMatchObject({
      model: "claude-fable-5-1",
      latency_ms: 1234,
      prompt_version: PROMPT_VERSION,
      llm_output: extraction,
      source: "text",
    });
  });
});
