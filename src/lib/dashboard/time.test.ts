import { describe, expect, it } from "vitest";
import { relativeTime } from "./time";

const now = new Date("2026-11-06T12:00:00.000Z");

describe("relativeTime", () => {
  it.each([
    ["2026-11-06T11:59:40.000Z", "just now"],
    ["2026-11-06T11:57:00.000Z", "3m ago"],
    ["2026-11-06T10:00:00.000Z", "2h ago"],
    ["2026-11-05T11:00:00.000Z", "yesterday"],
    ["2026-11-03T12:00:00.000Z", "3d ago"],
    ["2026-10-04T12:00:00.000Z", "Oct 4"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
