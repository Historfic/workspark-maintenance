import { describe, expect, it } from "vitest";
import { makeExtraction, makeIssue, sampleText } from "@/test/fixtures";
import { groundExtraction, normalizeUnit, quoteAppearsIn, unitAppearsIn } from "./ground";

describe("unit grounding", () => {
  it("normalizes the common ways a unit is written", () => {
    expect(normalizeUnit("Apt. 4b")).toBe("4B");
    expect(normalizeUnit("#12-C")).toBe("12C");
    expect(normalizeUnit("unit 7A")).toBe("7A");
  });

  it("finds a unit only when the report actually states it", () => {
    expect(unitAppearsIn("4B", sampleText("r1"))).toBe(true);
    expect(unitAppearsIn("apt 7a", sampleText("r4"))).toBe(true);
    expect(unitAppearsIn("3A", sampleText("r2"))).toBe(false);
    expect(unitAppearsIn("2", sampleText("r5"))).toBe(false);
  });

  it("needs a digit before a stray letter can pass as a unit", () => {
    expect(unitAppearsIn("A", sampleText("r3"))).toBe(false);
    expect(unitAppearsIn("I", sampleText("r4"))).toBe(false);
    expect(unitAppearsIn("4B", sampleText("r1"))).toBe(true);
    expect(unitAppearsIn("12C", sampleText("r3"))).toBe(true);
    expect(unitAppearsIn("7A", sampleText("r4"))).toBe(true);
    expect(unitAppearsIn("2D", sampleText("r5"))).toBe(true);
  });
});

describe("quote grounding", () => {
  it("ignores case, spacing, curly apostrophes and edge punctuation", () => {
    expect(quoteAppearsIn("It’s  dripping onto the outlet!", sampleText("r1"))).toBe(true);
  });

  it("rejects words the caller never said", () => {
    expect(quoteAppearsIn("the toilet overflowed", sampleText("r1"))).toBe(false);
  });
});

describe("groundExtraction", () => {
  it("keeps a stated unit in normalized form", () => {
    const grounded = groundExtraction(
      makeExtraction([
        makeIssue({ unit: "apt 4b", source_quote: "it's dripping onto the outlet" }),
      ]),
      sampleText("r1"),
    );
    expect(grounded.issues[0]).toMatchObject({
      unit: "4B",
      missing_fields: [],
      grounding_notes: [],
    });
  });

  it("drops an invented unit, asks for follow-up and records why", () => {
    const grounded = groundExtraction(
      makeExtraction([
        makeIssue({ unit: "3A", source_quote: "the heat isn't working in my place" }),
      ]),
      sampleText("r2"),
    );
    expect(grounded.issues[0]).toMatchObject({
      unit: null,
      missing_fields: ["unit_number"],
      grounding_notes: ["unit_not_in_report"],
    });
  });

  it("adds unit_number when the model returns no unit but forgets to flag it", () => {
    const grounded = groundExtraction(
      makeExtraction([
        makeIssue({ unit: null, source_quote: "the heat isn't working in my place" }),
      ]),
      sampleText("r2"),
    );
    expect(grounded.issues[0]?.missing_fields).toEqual(["unit_number"]);
  });

  it("clears unit_number when the unit is grounded", () => {
    const grounded = groundExtraction(
      makeExtraction([makeIssue({ unit: "12C", missing_fields: ["unit_number", "issue_detail"] })]),
      sampleText("r3"),
    );
    expect(grounded.issues[0]?.missing_fields).toEqual(["issue_detail"]);
  });

  it("discards a quote that is not in the report", () => {
    const grounded = groundExtraction(
      makeExtraction([makeIssue({ unit: "4B", source_quote: "the toilet overflowed" })]),
      sampleText("r1"),
    );
    expect(grounded.issues[0]).toMatchObject({
      source_quote: null,
      grounding_notes: ["quote_not_in_report"],
    });
  });

  it("keeps the caller's urgency quote only when it is verbatim", () => {
    const kept = groundExtraction(
      makeExtraction(
        [makeIssue({ unit: "2D", source_quote: "My bedroom window won't close all the way" })],
        {
          caller_stated_urgency: "low",
          caller_urgency_quote: "Not urgent, whenever you get a chance",
        },
      ),
      sampleText("r5"),
    );
    expect(kept.caller_urgency_quote).toBe("Not urgent, whenever you get a chance");

    const dropped = groundExtraction(
      makeExtraction(
        [makeIssue({ unit: "2D", source_quote: "My bedroom window won't close all the way" })],
        {
          caller_stated_urgency: "low",
          caller_urgency_quote: "It can wait until next month",
        },
      ),
      sampleText("r5"),
    );
    expect(dropped.caller_urgency_quote).toBeNull();
  });
});
