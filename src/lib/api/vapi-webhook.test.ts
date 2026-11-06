import { afterEach, describe, expect, it, vi } from "vitest";
import type { TriageStore } from "@/lib/db/store";
import type { TriageResult } from "@/lib/triage/types";
import { makeExtraction, makeIssue, scriptedExtractor } from "@/test/fixtures";
import {
  handleVapiWebhook,
  SECRET_HEADER,
  secretMatches,
  type VapiWebhookDeps,
} from "./vapi-webhook";

const SECRET = "test-webhook-secret-0123456789";

const CALL = {
  message: {
    type: "end-of-call-report",
    call: { id: "call-abc", type: "inboundPhoneCall" },
    customer: { number: "+14155554567" },
    artifact: {
      messages: [
        {
          role: "assistant",
          message: "Thanks for calling Workspark maintenance. What's going on?",
        },
        { role: "user", message: "This is 2D. My bedroom window won't close all the way." },
      ],
    },
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
  const deps: VapiWebhookDeps = {
    secret: SECRET,
    store,
    extract: extractor.extract,
    defer: (task) => tasks.push(task),
  };
  return { deps, saved, tasks, extractor };
}

function post(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers[SECRET_HEADER] = secret;
  return new Request("http://localhost/api/webhooks/vapi", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("secretMatches", () => {
  it("accepts only the exact secret", () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(`${SECRET}x`, SECRET)).toBe(false);
    expect(secretMatches("", SECRET)).toBe(false);
    expect(secretMatches(null, SECRET)).toBe(false);
  });
});

describe("POST /api/webhooks/vapi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a missing or wrong secret without doing any work", async () => {
    const { deps, tasks } = setup();
    expect((await handleVapiWebhook(post(CALL, null), deps)).status).toBe(401);
    expect((await handleVapiWebhook(post(CALL, "wrong"), deps)).status).toBe(401);
    expect(tasks).toHaveLength(0);
  });

  it("acknowledges other server messages and ignores them quietly", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps, tasks } = setup();
    const response = await handleVapiWebhook(post({ message: { type: "status-update" } }), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      action: "ignored",
      reason: "not_end_of_call",
    });
    expect(tasks).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns about an end-of-call report of the wrong shape without logging it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps, tasks } = setup();
    const body = {
      message: {
        type: "end-of-call-report",
        call: { id: 42 },
        customer: { number: "+14155554567" },
      },
    };
    const response = await handleVapiWebhook(post(body), deps);
    expect(await response.json()).toEqual({ received: true, action: "ignored", reason: "invalid" });
    expect(tasks).toHaveLength(0);
    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("4567");
  });

  it("answers at once and triages the call afterwards", async () => {
    const { deps, saved, tasks, extractor } = setup();
    const response = await handleVapiWebhook(post(CALL), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, action: "queued" });
    expect(extractor.callCount()).toBe(0);

    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.report).toMatchObject({
      source: "phone",
      caller_last4: "4567",
      vapi_call_id: "call-abc",
    });
    expect(saved[0]?.report.raw_text).toContain("Caller: This is 2D.");
    expect(saved[0]?.tickets[0]).toMatchObject({ issue_type: "Structural", unit: "2D" });
  });

  it("treats a repeated delivery of the same call as already handled", async () => {
    const { deps, tasks } = setup("duplicate");
    await handleVapiWebhook(post(CALL), deps);
    await expect(tasks[0]?.()).resolves.toBeUndefined();
  });

  it("logs the call id and rethrows when the deferred triage fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, tasks } = setup("fails");
    await handleVapiWebhook(post(CALL), deps);
    await expect(tasks[0]?.()).rejects.toThrow("database unavailable");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("call-abc"), expect.any(Error));
  });
});
