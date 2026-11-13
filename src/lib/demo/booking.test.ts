import { describe, expect, it } from "vitest";
import { bookingPlan } from "./booking";

const FRIDAY = "2026-11-13T15:00:00.000Z";

describe("bookingPlan", () => {
  it("dispatches emergencies now", () => {
    const plan = bookingPlan("Emergency", FRIDAY, "emergency_any_time", "UTC");
    expect(plan.visits).toEqual(["Now: the on-call super is dispatched"]);
    expect(plan.entry).toMatch(/may enter now/i);
  });

  it("offers same day for High", () => {
    expect(bookingPlan("High", FRIDAY, "permission_required", "UTC").visits).toEqual([
      "Today, as soon as possible",
    ]);
  });

  it("offers weekday windows from the super's schedule, skipping the weekend", () => {
    const plan = bookingPlan("Medium", FRIDAY, "permission_required", "UTC");
    expect(plan.visits).toEqual([
      "Mon, Nov 16 · 9am–12pm",
      "Mon, Nov 16 · 1–4pm",
      "Tue, Nov 17 · 9am–12pm",
    ]);
  });

  it("states the entry rule", () => {
    expect(bookingPlan("Low", FRIDAY, "tenant_present", "UTC").entry).toMatch(/tenant is home/i);
  });
});
