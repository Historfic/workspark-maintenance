import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { sortWorkOrders } from "./ordering";

describe("sortWorkOrders", () => {
  it("puts Emergency first, then High, Medium, Low", () => {
    const rows = [
      makeWorkOrderRow({ id: "low", priority: "Low" }),
      makeWorkOrderRow({ id: "em", priority: "Emergency" }),
      makeWorkOrderRow({ id: "med", priority: "Medium" }),
      makeWorkOrderRow({ id: "high", priority: "High" }),
    ];
    expect(sortWorkOrders(rows).map((r) => r.id)).toEqual(["em", "high", "med", "low"]);
  });

  it("orders newest first within a priority and leaves the input untouched", () => {
    const older = makeWorkOrderRow({ id: "older", created_at: "2026-11-06T09:00:00.000Z" });
    const newer = makeWorkOrderRow({ id: "newer", created_at: "2026-11-06T11:00:00.000Z" });
    const input = [older, newer];
    expect(sortWorkOrders(input).map((r) => r.id)).toEqual(["newer", "older"]);
    expect(input.map((r) => r.id)).toEqual(["older", "newer"]);
  });
});
