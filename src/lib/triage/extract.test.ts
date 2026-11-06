import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { makeExtraction, makeIssue } from "@/test/fixtures";
import { createExtractor } from "./extract";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { EXTRACTION_JSON_SCHEMA } from "./schema";
import { ExtractionError } from "./types";

interface Captured {
  headers: Headers;
  body: Record<string, unknown>;
}

function message(text: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-fable-5-1",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 },
    ...overrides,
  };
}

function fakeClient(responseBody: unknown, status = 200, captured: Captured[] = []) {
  return new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: async (_input, init) => {
      captured.push({
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify(responseBody), {
        status,
        headers: { "content-type": "application/json" },
      });
    },
  });
}

const extraction = makeExtraction([makeIssue()]);
const call = { text: "Unit 12C here. The kitchen sink is clogged.", source: "text" as const };

describe("createExtractor", () => {
  it("sends a structured-output request with server-side fallback", async () => {
    const captured: Captured[] = [];
    await createExtractor(fakeClient(message(JSON.stringify(extraction)), 200, captured))(call);
    const [request] = captured;
    expect(request?.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(request?.body).toMatchObject({
      model: "claude-fable-5-1",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      fallbacks: "default",
    });
    expect(request?.body.output_config).toEqual({
      effort: "low",
      format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA },
    });
    expect(request?.body.messages).toEqual([
      { role: "user", content: buildUserMessage(call.text, call.source) },
    ]);
    expect(request?.body).not.toHaveProperty("thinking");
  });

  it("leaves fallbacks off for models that do not support them", async () => {
    const captured: Captured[] = [];
    await createExtractor(
      fakeClient(message(JSON.stringify(extraction)), 200, captured),
      "claude-haiku-5-5",
    )(call);
    expect(captured[0]?.body).not.toHaveProperty("fallbacks");
    expect(captured[0]?.headers.get("anthropic-beta")).toBeNull();
  });

  it("returns the validated output with model and latency", async () => {
    const result = await createExtractor(fakeClient(message(JSON.stringify(extraction))))(call);
    expect(result.output).toEqual(extraction);
    expect(result.model).toBe("claude-fable-5-1");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ["refusal", message("", { stop_reason: "refusal" })],
    ["truncated", message("{", { stop_reason: "max_tokens" })],
    ["invalid_output", message("not json")],
    ["invalid_output", message(JSON.stringify({ issues: [] }))],
  ])("raises ExtractionError(%s)", async (kind, body) => {
    await expect(createExtractor(fakeClient(body))(call)).rejects.toMatchObject({
      name: "ExtractionError",
      kind,
    });
  });

  it("wraps API errors so the pipeline can retry", async () => {
    const error = { type: "error", error: { type: "api_error", message: "overloaded" } };
    const attempt = createExtractor(fakeClient(error, 529))(call);
    await expect(attempt).rejects.toBeInstanceOf(ExtractionError);
    await expect(attempt).rejects.toMatchObject({ kind: "api" });
  });
});
