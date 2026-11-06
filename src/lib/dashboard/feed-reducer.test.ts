import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { announceFor, feedReducer, initialFeedState } from "./feed-reducer";

const a = makeWorkOrderRow({ id: "a", priority: "Low" });
const b = makeWorkOrderRow({ id: "b", priority: "Emergency", issue_type: "Gas", unit: "7A" });

describe("feedReducer", () => {
  it("inserts a realtime row, marks it recent and announces it", () => {
    const next = feedReducer(initialFeedState([a]), { type: "upsert", row: b, fromRealtime: true });
    expect(next.orders.map((r) => r.id)).toEqual(["b", "a"]);
    expect(next.recentIds).toEqual(["b"]);
    expect(next.announcement).toEqual({ seq: 1, text: "New Emergency ticket: Gas, unit 7A" });
  });

  it("replaces an existing row in place without re-announcing", () => {
    const state = feedReducer(initialFeedState([a]), {
      type: "upsert",
      row: b,
      fromRealtime: true,
    });
    expect(state.announcement).not.toBeNull();
    const next = feedReducer(state, {
      type: "upsert",
      row: { ...a, status: "Done" },
      fromRealtime: true,
    });
    expect(next.orders.find((r) => r.id === "a")?.status).toBe("Done");
    expect(next.recentIds).toEqual(state.recentIds);
    expect(next.announcement).toEqual(state.announcement);
    expect(next.announcementSeq).toBe(state.announcementSeq);
  });

  it("re-announces identical text under a new sequence number", () => {
    const twin = makeWorkOrderRow({
      id: "c",
      priority: "Emergency",
      issue_type: "Gas",
      unit: "7A",
    });
    const first = feedReducer(initialFeedState([]), { type: "upsert", row: b, fromRealtime: true });
    const second = feedReducer(first, { type: "upsert", row: twin, fromRealtime: true });
    expect(first.announcement).toEqual({ seq: 1, text: "New Emergency ticket: Gas, unit 7A" });
    expect(second.announcement).toEqual({ seq: 2, text: "New Emergency ticket: Gas, unit 7A" });
  });

  it("does not mark rows recent when the insert came from this tab", () => {
    const next = feedReducer(initialFeedState([]), { type: "upsert", row: b, fromRealtime: false });
    expect(next.recentIds).toEqual([]);
  });

  it("applies and can revert a status locally", () => {
    const applied = feedReducer(initialFeedState([a]), {
      type: "setStatus",
      id: "a",
      status: "In Progress",
    });
    expect(applied.orders[0]?.status).toBe("In Progress");
    const reverted = feedReducer(applied, { type: "setStatus", id: "a", status: "New" });
    expect(reverted.orders[0]?.status).toBe("New");
  });

  it("tracks connection state and clears recent ids", () => {
    const s1 = feedReducer(initialFeedState([]), { type: "connection", value: "reconnecting" });
    expect(s1.connection).toBe("reconnecting");
    const s2 = feedReducer({ ...s1, recentIds: ["b"] }, { type: "clearRecent", id: "b" });
    expect(s2.recentIds).toEqual([]);
  });

  it("announces a follow-up ticket with 'unit unknown'", () => {
    expect(
      announceFor(makeWorkOrderRow({ priority: "High", issue_type: "HVAC", unit: null })),
    ).toBe("New High ticket: HVAC, unit unknown");
  });
});
