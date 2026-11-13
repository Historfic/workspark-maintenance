import { describe, expect, it } from "vitest";
import { parseRetellEvent } from "./call-ended";

const callEnded = (call: Record<string, unknown>) => ({ event: "call_ended", call });

describe("parseRetellEvent", () => {
  it("turns a finished web call into a transcript report", () => {
    const parsed = parseRetellEvent(
      callEnded({
        call_id: "call_1",
        call_type: "web_call",
        transcript_object: [
          { role: "agent", content: "Hi, this is Maya. What's going on?" },
          { role: "user", content: "I'm in 7A and I smell gas near the stove." },
        ],
      }),
    );
    expect(parsed).toEqual({
      kind: "report",
      report: {
        callId: "call_1",
        source: "web_call",
        callerLast4: null,
        transcript:
          "Agent: Hi, this is Maya. What's going on?\nCaller: I'm in 7A and I smell gas near the stove.",
      },
    });
  });

  it("keeps the caller's last four digits for a phone call", () => {
    const parsed = parseRetellEvent(
      callEnded({
        call_id: "call_2",
        call_type: "phone_call",
        from_number: "+14155554567",
        transcript_object: [{ role: "user", content: "Heat is out in 3A." }],
      }),
    );
    expect(parsed.kind === "report" && parsed.report).toMatchObject({
      source: "phone",
      callerLast4: "4567",
    });
  });

  it("ignores other events, silent calls and malformed bodies", () => {
    expect(parseRetellEvent({ event: "call_started", call: { call_id: "x" } })).toEqual({
      kind: "ignored",
      reason: "not_call_ended",
    });
    expect(
      parseRetellEvent(
        callEnded({ call_id: "x", transcript_object: [{ role: "agent", content: "Hello?" }] }),
      ),
    ).toEqual({ kind: "ignored", reason: "no_caller_speech" });
    expect(parseRetellEvent({ nope: true })).toEqual({ kind: "ignored", reason: "invalid" });
  });
});
