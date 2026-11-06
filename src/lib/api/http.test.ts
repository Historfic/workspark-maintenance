import { describe, expect, it, vi } from "vitest";
import { withErrorBoundary } from "./http";

describe("withErrorBoundary", () => {
  it("turns an unexpected throw into a JSON 500 without leaking the message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorBoundary(async () => {
      throw new Error("connection string postgres://secret");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("postgres");
  });
});
