import { describe, expect, it } from "vitest";
import { callReducer, describeCallError, formatElapsed, type CallState } from "./call-state";

const idle: CallState = { kind: "idle" };

describe("callReducer", () => {
  it("walks a normal call from start to end", () => {
    const connecting = callReducer(idle, { type: "start" });
    expect(connecting).toEqual({ kind: "connecting" });
    const live = callReducer(connecting, { type: "connected", at: 1000 });
    expect(live).toEqual({ kind: "live", startedAt: 1000, agentSpeaking: false });
    const speaking = callReducer(live, { type: "agent-speech", speaking: true });
    expect(speaking).toEqual({ kind: "live", startedAt: 1000, agentSpeaking: true });
    const ending = callReducer(speaking, { type: "hang-up" });
    expect(ending).toEqual({ kind: "ending" });
    expect(callReducer(ending, { type: "ended" })).toEqual({ kind: "ended" });
  });

  it("ignores a second start while a call is connecting or live", () => {
    const connecting = callReducer(idle, { type: "start" });
    expect(callReducer(connecting, { type: "start" })).toBe(connecting);
  });

  it("moves a connecting call to ending on hang-up", () => {
    expect(callReducer({ kind: "connecting" }, { type: "hang-up" })).toEqual({ kind: "ending" });
  });

  it("ends a live call when the other side hangs up", () => {
    const live: CallState = { kind: "live", startedAt: 1000, agentSpeaking: false };
    expect(callReducer(live, { type: "ended" })).toEqual({ kind: "ended" });
  });

  it("ignores a stale call-end while a new call is still connecting", () => {
    const connecting: CallState = { kind: "connecting" };
    expect(callReducer(connecting, { type: "ended" })).toBe(connecting);
  });

  it("ignores call-end when no call is in progress", () => {
    const ended: CallState = { kind: "ended" };
    expect(callReducer(idle, { type: "ended" })).toBe(idle);
    expect(callReducer(ended, { type: "ended" })).toBe(ended);
  });

  it("keeps the error when the SDK reports call-end after a failure", () => {
    const failed = callReducer({ kind: "connecting" }, { type: "failed", message: "No mic" });
    expect(callReducer(failed, { type: "ended" })).toBe(failed);
  });

  it("treats a failure reported after the caller hung up as the call ending", () => {
    expect(callReducer({ kind: "ending" }, { type: "failed", message: "Aborted" })).toEqual({
      kind: "ended",
    });
  });

  it("keeps the first failure message when the SDK reports a second one", () => {
    const failed: CallState = { kind: "error", message: "No mic" };
    expect(callReducer(failed, { type: "failed", message: "Generic" })).toBe(failed);
  });

  it("can start again after a call ended or failed", () => {
    expect(callReducer({ kind: "ended" }, { type: "start" })).toEqual({ kind: "connecting" });
    expect(callReducer({ kind: "error", message: "x" }, { type: "start" })).toEqual({
      kind: "connecting",
    });
  });
});

describe("formatElapsed", () => {
  it("shows minutes and zero-padded seconds, never negative", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65_400)).toBe("1:05");
    expect(formatElapsed(-500)).toBe("0:00");
  });
});

describe("describeCallError", () => {
  it("explains a blocked microphone", () => {
    const denied = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    expect(describeCallError(denied)).toMatch(/microphone/i);
    expect(describeCallError({ error: { message: "Permission denied by system" } })).toMatch(
      /microphone/i,
    );
  });

  it("falls back to a generic message", () => {
    expect(describeCallError({ type: "daily-error" })).toMatch(/could not connect/i);
    expect(describeCallError(undefined)).toMatch(/could not connect/i);
  });
});
