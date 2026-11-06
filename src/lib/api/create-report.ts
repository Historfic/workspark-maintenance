import { z } from "zod";
import type { TriageStore } from "@/lib/db/store";
import { MAX_REPORT_CHARS, normalizeReportText } from "@/lib/triage/normalize";
import { runTriage } from "@/lib/triage/pipeline";
import type { Extractor } from "@/lib/triage/types";
import { clientIp } from "./client-ip";
import { errorResponse, readJson } from "./http";

export interface CreateReportDeps {
  store: TriageStore;
  extract: Extractor;
  hashIp: (ip: string) => string;
  maxPerMinute: number;
}

const bodySchema = z.object({ text: z.string().max(MAX_REPORT_CHARS * 4) });

export async function handleCreateReport(req: Request, deps: CreateReportDeps): Promise<Response> {
  const body = bodySchema.safeParse(await readJson(req));
  if (!body.success) return errorResponse("invalid_input", 'Send JSON like {"text": "..."}.');

  const normalized = normalizeReportText(body.data.text, MAX_REPORT_CHARS);
  if (!normalized.ok) {
    return errorResponse(
      "invalid_input",
      normalized.reason === "empty"
        ? "The report is empty."
        : `Reports are limited to ${MAX_REPORT_CHARS} characters.`,
    );
  }

  const allowed = await deps.store.allowIntake(
    deps.hashIp(clientIp(req.headers)),
    deps.maxPerMinute,
  );
  if (!allowed) {
    return errorResponse(
      "rate_limited",
      "Too many reports from this address. Wait a minute and try again.",
      {
        "Retry-After": "60",
      },
    );
  }

  const result = await runTriage(
    { text: normalized.text, source: "text", callerLast4: null, vapiCallId: null },
    deps.extract,
  );
  const saved = await deps.store.saveTriage(result);
  if (!saved) return errorResponse("internal", "The report could not be saved.");
  return Response.json({ report: saved.report, work_orders: saved.workOrders }, { status: 201 });
}
