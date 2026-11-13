import { describe, expect, it } from "vitest";
import { DEMO_PROPERTIES, findTenant, propertyOf, rmTicketNumber } from "./rent-manager";

describe("findTenant", () => {
  it("finds the tenant for every unit named in the sample reports", () => {
    for (const unit of ["4B", "12C", "7A", "2D"]) {
      expect(findTenant(unit)?.unit).toBe(unit);
    }
  });

  it("ignores case and surrounding spaces", () => {
    expect(findTenant(" 12c ")?.unit).toBe("12C");
  });

  it("returns null for no unit or an unknown unit", () => {
    expect(findTenant(null)).toBeNull();
    expect(findTenant("99Z")).toBeNull();
  });

  it("links each tenant to a demo property", () => {
    const tenant = findTenant("4B");
    expect(tenant && propertyOf(tenant)).toBeDefined();
    expect(DEMO_PROPERTIES.length).toBeGreaterThan(1);
  });
});

describe("rmTicketNumber", () => {
  it("is stable for the same ticket id", () => {
    const id = "6f1c2a7e-0d3b-4a51-9a1e-2b7d8f0c4e11";
    expect(rmTicketNumber(id)).toBe(rmTicketNumber(id));
  });

  it("looks like a Rent Manager service issue number", () => {
    expect(rmTicketNumber("abc")).toMatch(/^SI-\d{4}$/);
  });

  it("differs between tickets", () => {
    expect(rmTicketNumber("ticket-a")).not.toBe(rmTicketNumber("ticket-b"));
  });
});
