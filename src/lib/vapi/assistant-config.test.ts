import { describe, expect, it } from "vitest";
import { MAX_CALL_SECONDS } from "@/lib/voice/constants";
import { buildAssistantConfig, isOwnAssistant, isOwnPhoneNumber } from "./assistant-config";

describe("buildAssistantConfig", () => {
  const config = buildAssistantConfig({
    serverUrl: "https://workspark-maintenance.vercel.app/api/webhooks/vapi",
    credentialId: "cred-1",
  });

  it("sends only end-of-call reports to our webhook, signed by our credential", () => {
    expect(config.server).toEqual({
      url: "https://workspark-maintenance.vercel.app/api/webhooks/vapi",
      credentialId: "cred-1",
      timeoutSeconds: 20,
    });
    expect(config.serverMessages).toEqual(["end-of-call-report"]);
  });

  it("caps the call, turns recording off and tags the assistant as ours", () => {
    expect(config.maxDurationSeconds).toBe(MAX_CALL_SECONDS);
    expect(config.artifactPlan).toEqual({ recordingEnabled: false, pcapEnabled: false });
    expect(config.name).toBe("test");
    expect(config.metadata).toEqual({ app: "workspark-maintenance" });
  });

  it("uses Claude Haiku for the conversation and lets it hang up", () => {
    expect(config.model.provider).toBe("anthropic");
    expect(config.model.model).toBe("claude-haiku-5-5");
    expect(config.model.tools).toEqual([{ type: "endCall" }]);
    expect(config.model.messages[0]?.content).toMatch(/unit/i);
  });
});

describe("isOwnAssistant", () => {
  it("recognises only this app's assistant", () => {
    expect(isOwnAssistant({ name: "test", metadata: { app: "workspark-maintenance" } })).toBe(true);
    expect(isOwnAssistant({ name: "Amy" })).toBe(false);
    expect(isOwnAssistant({ name: "test" })).toBe(false);
    expect(isOwnAssistant({ name: "test", metadata: { app: "something-else" } })).toBe(false);
    expect(isOwnAssistant(null)).toBe(false);
  });
});

describe("isOwnPhoneNumber", () => {
  it("recognises only the free Vapi number this app created", () => {
    expect(isOwnPhoneNumber({ provider: "vapi", name: "Workspark test line" })).toBe(true);
    expect(isOwnPhoneNumber({ provider: "twilio", name: "Workspark test line" })).toBe(false);
    expect(isOwnPhoneNumber({ provider: "vapi", name: "Client line" })).toBe(false);
  });
});
