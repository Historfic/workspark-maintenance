import { z } from "zod";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/triage/normalize";

export interface RetellCallReport {
  callId: string;
  source: "phone" | "web_call";
  callerLast4: string | null;
  transcript: string;
}

export type ParsedRetellEvent =
  | { kind: "report"; report: RetellCallReport }
  | { kind: "ignored"; reason: "invalid" | "not_call_ended" | "no_caller_speech" };

const envelopeSchema = z.object({ event: z.string() });

const callEndedSchema = z.object({
  call: z.object({
    call_id: z.string().min(1),
    call_type: z.string().nullish(),
    from_number: z.string().nullish(),
    transcript_object: z
      .array(z.object({ role: z.string(), content: z.string().nullish() }))
      .nullish(),
  }),
});

const SPEAKER: Record<string, string> = { user: "Caller", agent: "Agent" };

function lastFourDigits(number: string | null | undefined): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function parseRetellEvent(body: unknown): ParsedRetellEvent {
  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) return { kind: "ignored", reason: "invalid" };
  if (envelope.data.event !== "call_ended") return { kind: "ignored", reason: "not_call_ended" };

  const parsed = callEndedSchema.safeParse(body);
  if (!parsed.success) return { kind: "ignored", reason: "invalid" };

  const { call } = parsed.data;
  const turns = (call.transcript_object ?? []).flatMap(({ role, content }) => {
    const speaker = SPEAKER[role];
    const text = content?.trim();
    return speaker && text ? [{ role, line: `${speaker}: ${text}` }] : [];
  });
  if (!turns.some((turn) => turn.role === "user")) {
    return { kind: "ignored", reason: "no_caller_speech" };
  }

  const phone = call.call_type === "phone_call";
  return {
    kind: "report",
    report: {
      callId: call.call_id,
      source: phone ? "phone" : "web_call",
      callerLast4: phone ? lastFourDigits(call.from_number) : null,
      transcript: turns
        .map((turn) => turn.line)
        .join("\n")
        .slice(0, MAX_TRANSCRIPT_CHARS),
    },
  };
}
