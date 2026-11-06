import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createServerStore } from "@/lib/db/server-store";
import type { TriageStore } from "@/lib/db/store";
import { requireEnv } from "@/lib/env";
import { createExtractor, DEFAULT_MODEL } from "@/lib/triage/extract";
import type { Extractor } from "@/lib/triage/types";
import { hashIp } from "./client-ip";
import type { CreateReportDeps } from "./create-report";
import type { VapiWebhookDeps } from "./vapi-webhook";

const MAX_REPORTS_PER_MINUTE = 10;

let cachedStore: TriageStore | null = null;
let cachedExtractor: Extractor | null = null;
let cachedDeps: CreateReportDeps | null = null;

export function getStore(): TriageStore {
  if (cachedStore) return cachedStore;
  cachedStore = createServerStore(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
  );
  return cachedStore;
}

function getExtractor(): Extractor {
  if (cachedExtractor) return cachedExtractor;
  cachedExtractor = createExtractor(
    new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") }),
    process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  );
  return cachedExtractor;
}

export function getDeps(): CreateReportDeps {
  if (cachedDeps) return cachedDeps;
  const salt = requireEnv("RATE_LIMIT_SALT");
  cachedDeps = {
    store: getStore(),
    extract: getExtractor(),
    hashIp: (ip) => hashIp(ip, salt),
    maxPerMinute: MAX_REPORTS_PER_MINUTE,
  };
  return cachedDeps;
}

export function getVapiDeps(defer: VapiWebhookDeps["defer"]): VapiWebhookDeps {
  return {
    secret: requireEnv("VAPI_WEBHOOK_SECRET"),
    store: getStore(),
    extract: getExtractor(),
    defer,
  };
}
