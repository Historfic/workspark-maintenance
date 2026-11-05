import { describe, expect, it } from "vitest";
import { normalizeReportText } from "./normalize";

describe("normalizeReportText", () => {
  it("trims, collapses spaces and keeps at most one blank line", () => {
    expect(normalizeReportText("  Unit 4B   here.\r\n\r\n\r\nWater   leak  ", 2000)).toEqual({
      ok: true,
      text: "Unit 4B here.\n\nWater leak",
    });
  });

  it("strips control characters", () => {
    expect(normalizeReportText("Unit\u0007 4B\u0000", 2000)).toEqual({ ok: true, text: "Unit 4B" });
  });

  it("rejects input that is empty after clean-up", () => {
    expect(normalizeReportText(" \n\t \u0000", 2000)).toEqual({ ok: false, reason: "empty" });
  });

  it("measures the limit after clean-up", () => {
    expect(normalizeReportText("a".repeat(10) + "    ", 10)).toEqual({
      ok: true,
      text: "a".repeat(10),
    });
    expect(normalizeReportText("a".repeat(11), 10)).toEqual({ ok: false, reason: "too_long" });
  });
});
