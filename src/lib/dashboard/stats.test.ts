import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { dailyIntake, openByPriority } from "./stats";

describe("openByPriority", () => {
  it("counts open tickets per priority, Emergency first, zeros included, Done excluded", () => {
    const rows = [
      makeWorkOrderRow({ id: "a", priority: "Emergency" }),
      makeWorkOrderRow({ id: "b", priority: "Emergency", status: "Done" }),
      makeWorkOrderRow({ id: "c", priority: "Low", status: "In Progress" }),
      makeWorkOrderRow({ id: "d", priority: "Low" }),
    ];
    expect(openByPriority(rows)).toEqual([
      { priority: "Emergency", count: 1 },
      { priority: "High", count: 0 },
      { priority: "Medium", count: 0 },
      { priority: "Low", count: 2 },
    ]);
  });
});

describe("dailyIntake", () => {
  const now = new Date("2026-11-07T09:00:00.000Z");

  it("returns one bucket per day ending today, oldest first", () => {
    const buckets = dailyIntake([], now);
    expect(buckets.map((b) => b.day)).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
    expect(buckets.at(-1)?.label).toBe("Sat");
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("counts tickets by UTC day and ignores those outside the window", () => {
    const rows = [
      makeWorkOrderRow({ id: "a", created_at: "2026-11-07T01:00:00.000Z" }),
      makeWorkOrderRow({ id: "b", created_at: "2026-11-06T23:59:59+00:00" }),
      makeWorkOrderRow({ id: "c", created_at: "2026-11-06T00:00:00.000Z" }),
      makeWorkOrderRow({ id: "d", created_at: "2026-10-20T12:00:00.000Z" }),
    ];
    const byDay = Object.fromEntries(dailyIntake(rows, now).map((b) => [b.day, b.count]));
    expect(byDay["2026-11-07"]).toBe(1);
    expect(byDay["2026-11-06"]).toBe(2);
    expect(Object.values(byDay).reduce((a, b) => a + b, 0)).toBe(3);
  });
});
