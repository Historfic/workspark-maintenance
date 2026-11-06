import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { countFilters, FILTERS, matchesFilter } from "./filters";

const rows = [
  makeWorkOrderRow({ id: "a", priority: "Emergency", status: "New" }),
  makeWorkOrderRow({
    id: "b",
    priority: "High",
    status: "In Progress",
    unit: null,
    needs_followup: true,
  }),
  makeWorkOrderRow({ id: "c", priority: "Low", status: "Done" }),
];

describe("filters", () => {
  it("lists the six filters in display order", () => {
    expect(FILTERS.map((f) => f.key)).toEqual([
      "all",
      "emergency",
      "followup",
      "new",
      "in_progress",
      "done",
    ]);
  });

  it("matches by priority, follow-up flag and status", () => {
    expect(rows.filter((r) => matchesFilter(r, "all")).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(rows.filter((r) => matchesFilter(r, "emergency")).map((r) => r.id)).toEqual(["a"]);
    expect(rows.filter((r) => matchesFilter(r, "followup")).map((r) => r.id)).toEqual(["b"]);
    expect(rows.filter((r) => matchesFilter(r, "in_progress")).map((r) => r.id)).toEqual(["b"]);
    expect(rows.filter((r) => matchesFilter(r, "done")).map((r) => r.id)).toEqual(["c"]);
  });

  it("counts every filter", () => {
    expect(countFilters(rows)).toEqual({
      all: 3,
      emergency: 1,
      followup: 1,
      new: 1,
      in_progress: 1,
      done: 1,
    });
  });
});
