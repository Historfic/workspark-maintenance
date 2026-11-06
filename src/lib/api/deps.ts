import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createServerStore } from "@/lib/db/server-store";
import { requireEnv } from "@/lib/env";
import { createExtractor, DEFAULT_MODEL } from "@/lib/triage/extract";
import { hashIp } from "./client-ip";
import type { CreateReportDeps } from "./create-report";

const MAX_REPORTS_PER_MINUTE = 10;

let cached: CreateReportDeps | null = null;

export function getDeps(): CreateReportDeps {
  if (cached) return cached;
  const salt = requireEnv("RATE_LIMIT_SALT");
  cached = {
    store: createServerStore(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SECRET_KEY"),
    ),
    extract: createExtractor(
      new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") }),
      process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    ),
    hashIp: (ip) => hashIp(ip, salt),
    maxPerMinute: MAX_REPORTS_PER_MINUTE,
  };
  return cached;
}
