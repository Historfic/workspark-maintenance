import { createHash, timingSafeEqual } from "node:crypto";
import type { TriageStore } from "@/lib/db/store";
import { MAX_TRANSCRIPT_CHARS, normalizeReportText } from "@/lib/triage/normalize";
import { runTriage } from "@/lib/triage/pipeline";
import type { Extractor } from "@/lib/triage/types";
import { parseServerMessage, type VapiCallReport } from "@/lib/vapi/end-of-call";
import { errorResponse, readJson } from "./http";

export const SECRET_HEADER = "x-vapi-secret";

export interface VapiWebhookDeps {
  secret: string;
  store: TriageStore;
  extract: Extractor;
  defer: (task: () => Promise<void>) => void;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function secretMatches(given: string | null, expected: string): boolean {
  return given !== null && timingSafeEqual(digest(given), digest(expected));
}

async function triageCall(call: VapiCallReport, deps: VapiWebhookDeps): Promise<void> {
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
  if (!saved) console.info(`Vapi call ${call.callId} was already saved; ignoring the repeat.`);
}

export async function handleVapiWebhook(req: Request, deps: VapiWebhookDeps): Promise<Response> {
  if (!secretMatches(req.headers.get(SECRET_HEADER), deps.secret)) {
    return errorResponse("unauthorized", "Missing or wrong webhook secret.");
  }
  const parsed = parseServerMessage(await readJson(req));
  if (parsed.kind === "ignored") {
    return Response.json({ received: true, action: "ignored", reason: parsed.reason });
  }
  deps.defer(() => triageCall(parsed.report, deps));
  return Response.json({ received: true, action: "queued" });
}
