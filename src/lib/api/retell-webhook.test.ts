import { sign } from "retell-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TriageStore } from "@/lib/db/store";
import type { TriageResult } from "@/lib/triage/types";
import { makeExtraction, makeIssue, scriptedExtractor } from "@/test/fixtures";
import { handleRetellWebhook, SIGNATURE_HEADER, type RetellWebhookDeps } from "./retell-webhook";

const API_KEY = "key_test_webhook_0123456789";

const CALL = {
  event: "call_ended",
  call: {
    call_id: "call_abc",
    call_type: "phone_call",
    from_number: "+14155554567",
    transcript_object: [
      { role: "agent", content: "Hi, you've reached the maintenance line. What's going on?" },
      { role: "user", content: "This is 2D. My bedroom window won't close all the way." },
    ],
  },
};

function setup(saveResult: "saved" | "duplicate" | "fails" = "saved") {
  const saved: TriageResult[] = [];
  const tasks: Array<() => Promise<void>> = [];
  const store: TriageStore = {
    saveTriage: vi.fn(async (result: TriageResult) => {
      if (saveResult === "fails") throw new Error("database unavailable");
      saved.push(result);
      return saveResult === "duplicate"
        ? null
        : { report: { ...result.report, id: "r1", created_at: "" }, workOrders: [] };
    }),
    allowIntake: vi.fn(async () => true),
    updateStatus: vi.fn(async () => null),
  };
  const extractor = scriptedExtractor([
    makeExtraction([
      makeIssue({
        issue_type: "Structural",
        priority: "Low",
        unit: "2D",
        area: "bedroom",
        summary: "Bedroom window won't close fully.",
        source_quote: "My bedroom window won't close all the way",
      }),
    ]),
  ]);
  const deps: RetellWebhookDeps = {
    apiKey: API_KEY,
    store,
    extract: extractor.extract,
    defer: (task) => tasks.push(task),
  };
  return { deps, saved, tasks, extractor };
}

async function post(body: unknown, signature?: string | null) {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const value = signature === undefined ? await sign(raw, API_KEY) : signature;
  if (value !== null) headers[SIGNATURE_HEADER] = value;
  return new Request("http://localhost/api/webhooks/retell", {
    method: "POST",
    headers,
    body: raw,
  });
}

describe("POST /api/webhooks/retell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a missing or wrong signature without doing any work", async () => {
    const { deps, tasks } = setup();
    expect((await handleRetellWebhook(await post(CALL, null), deps)).status).toBe(401);
    const forged = await sign(JSON.stringify(CALL), "key_someone_else");
    expect((await handleRetellWebhook(await post(CALL, forged), deps)).status).toBe(401);
    expect(tasks).toHaveLength(0);
  });

  it("acknowledges other events and ignores them", async () => {
    const { deps, tasks } = setup();
    const response = await handleRetellWebhook(
      await post({ event: "call_started", call: { call_id: "x" } }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      action: "ignored",
      reason: "not_call_ended",
    });
    expect(tasks).toHaveLength(0);
  });

  it("answers at once and triages the call afterwards", async () => {
    const { deps, saved, tasks, extractor } = setup();
    const response = await handleRetellWebhook(await post(CALL), deps);
    expect(await response.json()).toEqual({ received: true, action: "queued" });
    expect(extractor.callCount()).toBe(0);

    await tasks[0]?.();
    expect(saved[0]?.report).toMatchObject({
      source: "phone",
      caller_last4: "4567",
      vapi_call_id: "call_abc",
    });
    expect(saved[0]?.report.raw_text).toContain("Caller: This is 2D.");
    expect(saved[0]?.tickets[0]).toMatchObject({ issue_type: "Structural", unit: "2D" });
  });

  it("treats a repeated delivery of the same call as already handled", async () => {
    const { deps, tasks } = setup("duplicate");
    await handleRetellWebhook(await post(CALL), deps);
    await expect(tasks[0]?.()).resolves.toBeUndefined();
  });

  it("logs the call id and rethrows when the deferred triage fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, tasks } = setup("fails");
    await handleRetellWebhook(await post(CALL), deps);
    await expect(tasks[0]?.()).rejects.toThrow("database unavailable");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("call_abc"), expect.any(Error));
  });
});
