import { z } from "zod";

export const ASSISTANT_NAME = "test";
export const APP_TAG = "workspark-maintenance";
export const PHONE_NAME = "Workspark test line";
export const MAX_CALL_SECONDS = 120;

const INTAKE_PROMPT = `You answer the maintenance line for a residential building. This is a live phone call, so keep every reply to one or two short sentences.

Find out three things: what is wrong, which unit the caller is in, and where in the unit the problem is.
- Ask for one missing detail at a time, and ask for each detail at most once. If the caller does not know, accept that and move on.
- If the caller mentions more than one problem, note each one.
- If they mention gas, a burning smell, smoke, fire, sparks, flooding, or water near outlets or lights, first tell them to move away from it and call emergency services if anyone is in danger. Then continue.
- Never promise when someone will arrive, never quote prices, and never guess the cause.
- When you have what you need, read back a one-sentence summary, say the report is logged, and end the call with the endCall tool.`;

export interface AssistantConfig {
  name: string;
  metadata: { app: string };
  firstMessage: string;
  endCallMessage: string;
  model: {
    provider: "anthropic";
    model: string;
    maxTokens: number;
    messages: Array<{ role: "system"; content: string }>;
    tools: Array<{ type: "endCall" }>;
  };
  voice: { provider: "vapi"; voiceId: string };
  transcriber: { provider: "deepgram"; model: string; language: string };
  maxDurationSeconds: number;
  serverMessages: string[];
  server: { url: string; credentialId: string; timeoutSeconds: number };
  artifactPlan: { recordingEnabled: boolean; pcapEnabled: boolean };
}

export function buildAssistantConfig(input: {
  serverUrl: string;
  credentialId: string;
}): AssistantConfig {
  return {
    name: ASSISTANT_NAME,
    metadata: { app: APP_TAG },
    firstMessage: "Thanks for calling Workspark maintenance. What's going on?",
    endCallMessage:
      "Thanks. Your report is logged and the maintenance team can see it now. Goodbye.",
    model: {
      provider: "anthropic",
      model: "claude-haiku-5-5",
      maxTokens: 250,
      messages: [{ role: "system", content: INTAKE_PROMPT }],
      tools: [{ type: "endCall" }],
    },
    voice: { provider: "vapi", voiceId: "Elliot" },
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    maxDurationSeconds: MAX_CALL_SECONDS,
    serverMessages: ["end-of-call-report"],
    server: { url: input.serverUrl, credentialId: input.credentialId, timeoutSeconds: 20 },
    artifactPlan: { recordingEnabled: false, pcapEnabled: false },
  };
}

const ownAssistantSchema = z.object({
  name: z.literal(ASSISTANT_NAME),
  metadata: z.object({ app: z.literal(APP_TAG) }),
});

const ownPhoneSchema = z.object({ provider: z.literal("vapi"), name: z.literal(PHONE_NAME) });

export function isOwnAssistant(assistant: unknown): boolean {
  return ownAssistantSchema.safeParse(assistant).success;
}

export function isOwnPhoneNumber(phone: unknown): boolean {
  return ownPhoneSchema.safeParse(phone).success;
}
