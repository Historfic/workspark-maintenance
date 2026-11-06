import { z } from "zod";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/triage/normalize";

export interface VapiCallReport {
  callId: string;
  source: "phone" | "web_call";
  callerLast4: string | null;
  transcript: string;
}

export type ParsedServerMessage =
  | { kind: "report"; report: VapiCallReport }
  | { kind: "ignored"; reason: "invalid" | "not_end_of_call" | "no_caller_speech" };

const customerSchema = z.object({ number: z.string().optional() }).optional();

const envelopeSchema = z.object({ message: z.object({ type: z.string() }) });

const endOfCallSchema = z.object({
  message: z.object({
    call: z.object({
      id: z.string().min(1),
      type: z.string().optional(),
      customer: customerSchema,
    }),
    customer: customerSchema,
    artifact: z
      .object({
        messages: z
          .array(z.object({ role: z.string(), message: z.string().optional() }))
          .optional(),
      })
      .optional(),
  }),
});

const SPEAKER: Record<string, string> = { user: "Caller", assistant: "Agent", bot: "Agent" };

export function sourceFromCallType(type: string | undefined): "phone" | "web_call" {
  return type?.endsWith("PhoneCall") ? "phone" : "web_call";
}

export function lastFourDigits(number: string | undefined): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function transcriptFromMessages(
  messages: ReadonlyArray<{ role: string; message?: string }>,
): string {
  return messages
    .flatMap(({ role, message }) => {
      const speaker = SPEAKER[role];
      const text = message?.trim();
      return speaker && text ? [`${speaker}: ${text}`] : [];
    })
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
}

export function parseServerMessage(body: unknown): ParsedServerMessage {
  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) return { kind: "ignored", reason: "invalid" };
  if (envelope.data.message.type !== "end-of-call-report") {
    return { kind: "ignored", reason: "not_end_of_call" };
  }

  const parsed = endOfCallSchema.safeParse(body);
  if (!parsed.success) return { kind: "ignored", reason: "invalid" };

  const { call, customer, artifact } = parsed.data.message;
  const messages = artifact?.messages ?? [];
  const callerSpoke = messages.some((entry) => entry.role === "user" && entry.message?.trim());
  if (!callerSpoke) return { kind: "ignored", reason: "no_caller_speech" };

  return {
    kind: "report",
    report: {
      callId: call.id,
      source: sourceFromCallType(call.type),
      callerLast4: lastFourDigits(customer?.number ?? call.customer?.number),
      transcript: transcriptFromMessages(messages),
    },
  };
}
