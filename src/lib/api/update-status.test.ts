import { describe, expect, it, vi } from "vitest";
import type { WorkOrderRow } from "@/lib/db/types";
import { handleUpdateStatus } from "./update-status";

const ID = "0b9f4c7e-6a51-4c1e-9d3a-2f6b8e1a7c55";

function patch(body: unknown) {
  return new Request(`http://localhost/api/work-orders/${ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function storeReturning(row: Partial<WorkOrderRow> | null) {
  return {
    updateStatus: vi.fn(async () => (row === null ? null : ({ id: ID, ...row } as WorkOrderRow))),
  };
}

describe("PATCH /api/work-orders/:id", () => {
  it("updates the status", async () => {
    const store = storeReturning({ status: "In Progress" });
    const response = await handleUpdateStatus(patch({ status: "In Progress" }), ID, store);
    expect(response.status).toBe(200);
    expect(store.updateStatus).toHaveBeenCalledWith(ID, "In Progress");
  });

  it("rejects a status outside New / In Progress / Done", async () => {
    const store = storeReturning({ status: "New" });
    const response = await handleUpdateStatus(patch({ status: "Closed" }), ID, store);
    expect(response.status).toBe(400);
    expect(store.updateStatus).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed id without touching the database", async () => {
    const store = storeReturning(null);
    const response = await handleUpdateStatus(patch({ status: "Done" }), "not-a-uuid", store);
    expect(response.status).toBe(404);
    expect(store.updateStatus).not.toHaveBeenCalled();
  });

  it("returns 404 when no work order has that id", async () => {
    const response = await handleUpdateStatus(patch({ status: "Done" }), ID, storeReturning(null));
    expect(response.status).toBe(404);
  });
});
