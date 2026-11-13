import { verify } from "retell-sdk";
import type { TriageStore } from "@/lib/db/store";
import { parseRetellEvent, type RetellCallReport } from "@/lib/retell/call-ended";
import { MAX_TRANSCRIPT_CHARS, normalizeReportText } from "@/lib/triage/normalize";
import { runTriage } from "@/lib/triage/pipeline";
import type { Extractor } from "@/lib/triage/types";
import { errorResponse } from "./http";

export const SIGNATURE_HEADER = "x-retell-signature";

export interface RetellWebhookDeps {
  apiKey: string;
  store: TriageStore;
  extract: Extractor;
  defer: (task: () => Promise<void>) => void;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function triageCall(call: RetellCallReport, deps: RetellWebhookDeps): Promise<void> {
  const normalized = normalizeReportText(call.transcript, MAX_TRANSCRIPT_CHARS);
  if (!normalized.ok) return;
  const result = await runTriage(
    {
      text: normalized.text,
      source: call.source,
      callerLast4: call.callerLast4,
      vapiCallId: call.callId,
    },
    deps.extract,
  );
  const saved = await deps.store.saveTriage(result);
  if (!saved) console.info(`Retell call ${call.callId} was already saved; ignoring the repeat.`);
}

export async function handleRetellWebhook(
  req: Request,
  deps: RetellWebhookDeps,
): Promise<Response> {
  const raw = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  if (!signature || !(await verify(raw, deps.apiKey, signature))) {
    return errorResponse("unauthorized", "Missing or invalid Retell signature.");
  }
  const parsed = parseRetellEvent(parseJson(raw));
  if (parsed.kind === "ignored") {
    if (parsed.reason === "invalid") console.warn("Retell webhook body was not a call event.");
    return Response.json({ received: true, action: "ignored", reason: parsed.reason });
  }
  deps.defer(() =>
    triageCall(parsed.report, deps).catch((error: unknown) => {
      console.error(
        `Retell call ${parsed.report.callId} could not be triaged or saved; resend it from the Retell dashboard.`,
        error,
      );
      throw error;
    }),
  );
  return Response.json({ received: true, action: "queued" });
}
