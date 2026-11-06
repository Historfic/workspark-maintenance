import { describe, expect, it } from "vitest";
import { sampleText } from "@/test/fixtures";
import { quoteRange } from "./highlight";

describe("quoteRange", () => {
  it("finds a verbatim quote", () => {
    const text = sampleText("r3");
    const range = quoteRange(text, "The kitchen sink is clogged");
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe("The kitchen sink is clogged");
  });

  it("tolerates case, curly apostrophes and extra spaces", () => {
    const text = sampleText("r1");
    const range = quoteRange(text, "IT’S  DRIPPING onto the outlet");
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe("it's dripping onto the outlet");
  });

  it("returns null for a missing or empty quote", () => {
    expect(quoteRange(sampleText("r5"), "the roof leaks")).toBeNull();
    expect(quoteRange(sampleText("r5"), null)).toBeNull();
    expect(quoteRange(sampleText("r5"), "   ")).toBeNull();
  });
});
