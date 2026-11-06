import { describe, expect, it, vi } from "vitest";
import type { SavedTriage, TriageStore } from "@/lib/db/store";
import { makeExtraction, makeIssue, sampleText, scriptedExtractor } from "@/test/fixtures";
import { ExtractionError, type TriageResult } from "@/lib/triage/types";
import { handleCreateReport, type CreateReportDeps } from "./create-report";

function toSaved({ report, tickets }: TriageResult): SavedTriage {
  const now = new Date().toISOString();
  return {
    report: { ...report, id: "report-1", created_at: now },
    workOrders: tickets.map((ticket, index) => ({
      ...ticket,
      id: `order-${index}`,
      report_id: "report-1",
      status: "New",
      created_at: now,
      updated_at: now,
    })),
  };
}

function setup(options: { allow?: boolean; steps?: Parameters<typeof scriptedExtractor>[0] } = {}) {
  const saved: TriageResult[] = [];
  const store: TriageStore = {
    saveTriage: vi.fn(async (result: TriageResult) => {
      saved.push(result);
      return toSaved(result);
    }),
    allowIntake: vi.fn(async () => options.allow ?? true),
    updateStatus: vi.fn(async () => null),
  };
  const extractor = scriptedExtractor(
    options.steps ?? [
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
    ],
  );
  const deps: CreateReportDeps = {
    store,
    extract: extractor.extract,
    hashIp: (ip) => `hash:${ip}`,
    maxPerMinute: 10,
  };
  return { deps, store, saved, extractor };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/reports", () => {
  it("triages, saves and returns the work orders", async () => {
    const { deps, saved } = setup();
    const response = await handleCreateReport(post({ text: sampleText("r5") }), deps);
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      work_orders: Array<{ issue_type: string; unit: string }>;
    };
    expect(body.work_orders).toEqual([
      expect.objectContaining({ issue_type: "Structural", unit: "2D" }),
    ]);
    expect(saved[0]?.report.source).toBe("text");
  });

  it.each([
    ["missing text", {}],
    ["non-JSON body", "text=hello"],
    ["blank text", { text: "  \n\t " }],
  ])("rejects %s with 400", async (_label, body) => {
    const { deps, extractor } = setup();
    const response = await handleCreateReport(post(body), deps);
    expect(response.status).toBe(400);
    expect(extractor.callCount()).toBe(0);
  });

  it.each([
    ["text over the limit", { text: "a".repeat(2001) }],
    ["oversized body", { text: "a".repeat(20_000) }],
  ])("rejects %s with 400 and names the limit", async (_label, body) => {
    const { deps, extractor } = setup();
    const response = await handleCreateReport(post(body), deps);
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { message: string } };
    expect(json.error.message).toContain("limited to 2000 characters");
    expect(extractor.callCount()).toBe(0);
  });

  it("rate limits by hashed client IP before calling the model", async () => {
    const { deps, store, extractor } = setup({ allow: false });
    const response = await handleCreateReport(
      post({ text: sampleText("r5") }, { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
      deps,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(store.allowIntake).toHaveBeenCalledWith("hash:203.0.113.7", 10);
    expect(extractor.callCount()).toBe(0);
  });

  it("still saves a manual-review ticket when the model keeps failing", async () => {
    const { deps } = setup({ steps: [new ExtractionError("overloaded", "api")] });
    const response = await handleCreateReport(post({ text: sampleText("r5") }), deps);
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      work_orders: Array<{ issue_type: string; needs_followup: boolean }>;
    };
    expect(body.work_orders).toEqual([
      expect.objectContaining({ issue_type: "Other", needs_followup: true }),
    ]);
  });
});
