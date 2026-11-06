import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { parseWorkOrderRow } from "./row-schemas";

describe("parseWorkOrderRow", () => {
  it("accepts a well-formed row", () => {
    const row = makeWorkOrderRow();
    expect(parseWorkOrderRow(row)).toEqual(row);
  });

  it("rejects an unknown status or a missing id", () => {
    expect(parseWorkOrderRow({ ...makeWorkOrderRow(), status: "Closed" })).toBeNull();
    const noId = { ...makeWorkOrderRow(), id: undefined };
    expect(parseWorkOrderRow(noId)).toBeNull();
  });
});
