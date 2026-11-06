import { describe, expect, it } from "vitest";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/triage/normalize";
import { parseServerMessage, transcriptFromMessages } from "./end-of-call";

function endOfCall(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      type: "end-of-call-report",
      endedReason: "customer-ended-call",
      call: { id: "call-123", type: "webCall" },
      artifact: {
        messages: [
          { role: "system", message: "You are the maintenance intake line." },
          {
            role: "assistant",
            message: "Thanks for calling Workspark maintenance. What's going on?",
          },
          { role: "user", message: "Hi, I'm in 7A and I think I smell gas near the stove." },
          { role: "tool_calls", message: "" },
          { role: "bot", message: "Please step outside. I've logged it." },
        ],
      },
      ...overrides,
    },
  };
}

describe("parseServerMessage", () => {
  it("turns a browser call into a report with Caller and Agent lines", () => {
    const parsed = parseServerMessage(endOfCall());
    expect(parsed).toEqual({
      kind: "report",
      report: {
        callId: "call-123",
        source: "web_call",
        callerLast4: null,
        transcript: [
          "Agent: Thanks for calling Workspark maintenance. What's going on?",
          "Caller: Hi, I'm in 7A and I think I smell gas near the stove.",
          "Agent: Please step outside. I've logged it.",
        ].join("\n"),
      },
    });
  });

  it("marks phone calls and keeps only the last four digits of the caller", () => {
    const parsed = parseServerMessage(
      endOfCall({
        call: { id: "call-9", type: "inboundPhoneCall" },
        customer: { number: "+1 (415) 555-4567" },
      }),
    );
    expect(parsed.kind === "report" && parsed.report.source).toBe("phone");
    expect(parsed.kind === "report" && parsed.report.callerLast4).toBe("4567");
  });

  it("falls back to the caller number on the call object", () => {
    const parsed = parseServerMessage(
      endOfCall({
        call: { id: "call-9", type: "inboundPhoneCall", customer: { number: "+14155550199" } },
      }),
    );
    expect(parsed.kind === "report" && parsed.report.callerLast4).toBe("0199");
  });

  it("accepts the nulls Vapi sends for unset fields", () => {
    const parsed = parseServerMessage(
      endOfCall({
        call: { id: "call-null", type: "inboundPhoneCall", customer: { number: "+14155550123" } },
        customer: null,
        artifact: {
          messages: [
            { role: "assistant", message: null },
            { role: "tool_calls" },
            { role: "user", message: "Hi, this is 4B. The bathroom ceiling is leaking." },
          ],
        },
      }),
    );
    expect(parsed).toEqual({
      kind: "report",
      report: {
        callId: "call-null",
        source: "phone",
        callerLast4: "0123",
        transcript: "Caller: Hi, this is 4B. The bathroom ceiling is leaking.",
      },
    });
  });

  it("ignores other server messages", () => {
    expect(
      parseServerMessage({ message: { type: "status-update", status: "in-progress" } }),
    ).toEqual({
      kind: "ignored",
      reason: "not_end_of_call",
    });
  });

  it("ignores calls where the caller never spoke", () => {
    const parsed = parseServerMessage(
      endOfCall({
        artifact: {
          messages: [
            { role: "assistant", message: "Hello? Are you there?" },
            { role: "user", message: "  " },
          ],
        },
      }),
    );
    expect(parsed).toEqual({ kind: "ignored", reason: "no_caller_speech" });
  });

  it("rejects bodies that are not Vapi messages", () => {
    expect(parseServerMessage(undefined)).toEqual({ kind: "ignored", reason: "invalid" });
    expect(parseServerMessage({ message: { type: "end-of-call-report" } })).toEqual({
      kind: "ignored",
      reason: "invalid",
    });
  });
});

describe("transcriptFromMessages", () => {
  it("caps the transcript at the pipeline's transcript limit", () => {
    const long = Array.from({ length: 400 }, (_, index) => ({
      role: "user",
      message: `Line ${index} ${"x".repeat(40)}`,
    }));
    expect(transcriptFromMessages(long).length).toBe(MAX_TRANSCRIPT_CHARS);
  });
});
