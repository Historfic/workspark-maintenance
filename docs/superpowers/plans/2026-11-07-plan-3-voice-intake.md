# Plan 3: Voice intake through Vapi, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementers run on `model: "fable"`.

**Goal:** A tenant can report a problem by talking. There are two ways in: a "Call intake" button on the dashboard that runs the call in the browser, and a US phone number. When the call ends, the transcript goes through the existing triage pipeline and the tickets appear live on the dashboard.

**Architecture:** One Vapi assistant serves both entry points. The browser button uses `@vapi-ai/web` with a restricted public key, and the phone number is a free Vapi number attached to the same assistant. Vapi sends one `end-of-call-report` per call to `POST /api/webhooks/vapi`. The route checks the shared secret header, turns the call's messages into `Caller:` / `Agent:` lines, answers `200` at once, and then runs `runTriage` and `saveTriage` inside Next's `after()`. A unique `vapi_call_id` (already in the schema, with `on conflict do nothing`) makes a repeated delivery harmless. Supabase Realtime pushes the new rows to every open dashboard; no new UI plumbing is needed.

**Tech Stack:** Next.js 16.4.5 App Router (`after` from `next/server`), TypeScript 5.9 strict, Zod 4.6.7, Vitest 5.1.0, `@vapi-ai/web` 3.0.1 (new), and the Vapi REST API (`https://api.vapi.ai`).

**Branch:** `feat/voice`, created from the tip of `feat/dashboard` once Plan 2b V2 is reviewed. Its PR targets `main` and opens after the dashboard PR has merged. Merge with a merge commit.

## Decisions recorded here (these supersede spec §6 where they differ)

- **Assistant name.** The assistant is named **"test"** (Rafael, 2026-11-07). The spec called it "Workspark Intake".
- **Vapi org.** This is Rafael's business org, which holds live client assistants and ten Twilio client numbers.
  - The setup script finds this app's resources only by the IDs it stored, never by name.
  - Before it changes an assistant, it checks that the assistant is ours: name `test` **and** `metadata.app === "workspark-maintenance"`.
  - It never lists other resources for editing, and it never deletes anything.
- **Webhook authentication.** This uses a Vapi **webhook credential** (bearer plan, `headerName: "x-vapi-secret"`, `bearerPrefixEnabled: false`, token = `VAPI_WEBHOOK_SECRET`), referenced by `server.credentialId`.
  - Vapi's docs call an inline `server.secret` legacy, and the field is absent from the current API.
  - `GET /credential` answers 200 with the org key, so the credential endpoints exist.
- **Silence timeout.** `silenceTimeoutSeconds` is not in Vapi's current `CreateAssistantDTO`, so it is not set and Vapi's default applies. `maxDurationSeconds: 120` stays. Vapi documents it as a hard stop.
- **Public key.** Rafael created the public key in the Vapi dashboard. He sets its restrictions there: allowed origins `https://workspark-maintenance.vercel.app` and `http://localhost:3000`; allowed assistant `test`; transient assistants off. `/token` is not a public API path, so the script does not create keys.
- **Phone number.** This is a free Vapi US number: inbound only, a few minutes to activate. Callers outside the US pay their own international rate; the browser button is the way in for reviewers abroad.
- **Conversation model.** `claude-haiku-5-5` on Vapi's Anthropic provider, which Vapi lists. Fable still does the extraction after the call.
- **Webhook retries.** Vapi does not retry by default (`server.backoffPlan` unset), and its timeout is 20 s. Answering before the model runs keeps us well inside that.

## Global Constraints

- **Dependencies:** the only new one is `@vapi-ai/web` at exact version `3.0.1` (published 2026-10-23, older than pnpm's release-age floor; 3.1.0 is too new).
- **TypeScript:**
  - strict;
  - no `any`, no type assertions (`as`, including `as const`), no non-null assertions in source;
  - the SDK's `message` and `error` events are typed `any`, so narrow them as `unknown`.
- **Code style:**
  - no comments that narrate the code;
  - no blanket try/catch (a catch must handle one specific failure);
  - files under about 200 lines;
  - one way to do each thing.
- **Secrets:**
  - `VAPI_PRIVATE_KEY` and `VAPI_WEBHOOK_SECRET` are never printed, logged or committed;
  - scripts print resource IDs only;
  - `VAPI_PRIVATE_KEY` stays local, never in Vercel.
- **Caller privacy:** the caller's phone number is stored as its last four digits only.
- **Colour:** red is used only for Emergency. The End call button is not red.
- **Before every commit:**
  - run `pnpm format`;
  - stage explicit paths only (never `git add -A` or `.`);
  - check `git diff --cached` for key-shaped strings.
- **Commit trailer:** `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Gates:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (and `pnpm build` when more than 2 GB is free on C:) must be clean before a task's last commit. Never add `eslint-disable`. React 19's `react-hooks/set-state-in-effect` is on.
- **Skills:** load `ui-ux-pro-max` before Task 4.

## File map

| File | Job |
|---|---|
| `src/lib/vapi/end-of-call.ts` (+ test) | Parse a Vapi server message into a call report: call id, source, caller last four digits, transcript |
| `src/lib/api/vapi-webhook.ts` (+ test) | Webhook handler: secret check, ignore other messages, defer triage |
| `src/app/api/webhooks/vapi/route.ts` | Thin route: wires the handler to `after()` and real deps |
| `src/lib/api/deps.ts` (modify) | Shared cached extractor; `getVapiDeps(defer)` |
| `src/lib/vapi/assistant-config.ts` (+ test) | The assistant definition and the "is this ours?" guard |
| `scripts/vapi-setup.ts` | Idempotent setup: credential → assistant → phone number |
| `src/lib/voice/call-state.ts` (+ test) | Pure call-state reducer, elapsed-time format, error wording |
| `src/hooks/use-vapi-call.ts` | Loads the SDK on demand and maps its events onto the reducer |
| `src/components/intake/call-intake.tsx` | The "Call intake" controls and the dial-in number |
| `src/components/intake/intake-panel.tsx` (modify) | Renders `<CallIntake />` under the sample chips |

---

### Task 1: Parse Vapi end-of-call reports

**Files:**
- Create: `src/lib/vapi/end-of-call.ts`
- Test: `src/lib/vapi/end-of-call.test.ts`

**Interfaces:**
- Consumes: `MAX_TRANSCRIPT_CHARS` from `@/lib/triage/normalize` (8000).
- Produces:
  - `interface VapiCallReport { callId: string; source: "phone" | "web_call"; callerLast4: string | null; transcript: string }`
  - `type ParsedServerMessage = { kind: "report"; report: VapiCallReport } | { kind: "ignored"; reason: "invalid" | "not_end_of_call" | "no_caller_speech" }`
  - `parseServerMessage(body: unknown): ParsedServerMessage`
  - `transcriptFromMessages(messages: ReadonlyArray<{ role: string; message?: string }>): string`
  - `lastFourDigits(number: string | undefined): string | null`
  - `sourceFromCallType(type: string | undefined): "phone" | "web_call"`

Vapi payload facts this task relies on, from Vapi's OpenAPI spec:
- the body is `{ message: {...} }`;
- `message.type` is `"end-of-call-report"`;
- `message.call.id` and `message.call.type` are one of `inboundPhoneCall | outboundPhoneCall | webCall | vapi.websocketCall`;
- the caller number is at `message.customer.number`, falling back to `message.call.customer.number`;
- `message.artifact.messages[]` holds `{ role, message }`, with roles `user`, `assistant` (older payloads use `bot`), `system` and tool roles.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/triage/normalize";
import { parseServerMessage, transcriptFromMessages } from "./end-of-call";

function endOfCall(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      type: "end-of-call-report",
      endedReason: "customer-ended-call",
      call: { id: "call-123", type: "webCall" },
      artifact: {
        messages: [
          { role: "system", message: "You are the maintenance intake line." },
          { role: "assistant", message: "Thanks for calling Workspark maintenance. What's going on?" },
          { role: "user", message: "Hi, I'm in 7A and I think I smell gas near the stove." },
          { role: "tool_calls", message: "" },
          { role: "bot", message: "Please step outside. I've logged it." },
        ],
      },
      ...overrides,
    },
  };
}

describe("parseServerMessage", () => {
  it("turns a browser call into a report with Caller and Agent lines", () => {
    const parsed = parseServerMessage(endOfCall());
    expect(parsed).toEqual({
      kind: "report",
      report: {
        callId: "call-123",
        source: "web_call",
        callerLast4: null,
        transcript: [
          "Agent: Thanks for calling Workspark maintenance. What's going on?",
          "Caller: Hi, I'm in 7A and I think I smell gas near the stove.",
          "Agent: Please step outside. I've logged it.",
        ].join("\n"),
      },
    });
  });

  it("marks phone calls and keeps only the last four digits of the caller", () => {
    const parsed = parseServerMessage(
      endOfCall({
        call: { id: "call-9", type: "inboundPhoneCall" },
        customer: { number: "+1 (415) 555-4567" },
      }),
    );
    expect(parsed.kind === "report" && parsed.report.source).toBe("phone");
    expect(parsed.kind === "report" && parsed.report.callerLast4).toBe("4567");
  });

  it("falls back to the caller number on the call object", () => {
    const parsed = parseServerMessage(
      endOfCall({ call: { id: "call-9", type: "inboundPhoneCall", customer: { number: "+14155550199" } } }),
    );
    expect(parsed.kind === "report" && parsed.report.callerLast4).toBe("0199");
  });

  it("ignores other server messages", () => {
    expect(parseServerMessage({ message: { type: "status-update", status: "in-progress" } })).toEqual({
      kind: "ignored",
      reason: "not_end_of_call",
    });
  });

  it("ignores calls where the caller never spoke", () => {
    const parsed = parseServerMessage(
      endOfCall({ artifact: { messages: [{ role: "assistant", message: "Hello? Are you there?" }, { role: "user", message: "  " }] } }),
    );
    expect(parsed).toEqual({ kind: "ignored", reason: "no_caller_speech" });
  });

  it("rejects bodies that are not Vapi messages", () => {
    expect(parseServerMessage(undefined)).toEqual({ kind: "ignored", reason: "invalid" });
    expect(parseServerMessage({ message: { type: "end-of-call-report" } })).toEqual({
      kind: "ignored",
      reason: "invalid",
    });
  });
});

describe("transcriptFromMessages", () => {
  it("caps the transcript at the pipeline's transcript limit", () => {
    const long = Array.from({ length: 400 }, (_, index) => ({ role: "user", message: `Line ${index} ${"x".repeat(40)}` }));
    expect(transcriptFromMessages(long).length).toBe(MAX_TRANSCRIPT_CHARS);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run src/lib/vapi/end-of-call.test.ts`
Expected: FAIL. The module `./end-of-call` does not exist.

- [ ] **Step 3: Implement `src/lib/vapi/end-of-call.ts`**

```ts
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
        messages: z.array(z.object({ role: z.string(), message: z.string().optional() })).optional(),
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/vapi/end-of-call.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add src/lib/vapi/end-of-call.ts src/lib/vapi/end-of-call.test.ts
git commit -m "Parse Vapi end-of-call reports into transcripts" -m "Only the caller's lines are evidence for the pipeline, so the transcript keeps Caller and Agent labels and drops system and tool messages. Caller numbers shrink to the last four digits before they reach the database." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Webhook route

**Files:**
- Create: `src/lib/api/vapi-webhook.ts`
- Test: `src/lib/api/vapi-webhook.test.ts`
- Create: `src/app/api/webhooks/vapi/route.ts`
- Modify: `src/lib/api/deps.ts`
- Modify: `.env.example` (Vapi block)

**Interfaces:**
- Consumes:
  - `parseServerMessage`, `VapiCallReport` (Task 1);
  - `runTriage(input: TriageInput, extract: Extractor): Promise<TriageResult>` from `@/lib/triage/pipeline`;
  - `TriageStore.saveTriage(result): Promise<SavedTriage | null>`, which returns `null` when `vapi_call_id` already exists;
  - `normalizeReportText(raw, max)`, `MAX_TRANSCRIPT_CHARS`;
  - `errorResponse`, `readJson`, `withErrorBoundary` from `@/lib/api/http`.
- Produces:
  - `SECRET_HEADER = "x-vapi-secret"`
  - `interface VapiWebhookDeps { secret: string; store: TriageStore; extract: Extractor; defer: (task: () => Promise<void>) => void }`
  - `secretMatches(given: string | null, expected: string): boolean`
  - `handleVapiWebhook(req: Request, deps: VapiWebhookDeps): Promise<Response>`
  - `getVapiDeps(defer: VapiWebhookDeps["defer"]): VapiWebhookDeps` (in `deps.ts`)
  - Responses: `401 { error: { code: "unauthorized", ... } }`; `200 { received: true, action: "ignored", reason }`; `200 { received: true, action: "queued" }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import type { TriageStore } from "@/lib/db/store";
import type { TriageResult } from "@/lib/triage/types";
import { makeExtraction, makeIssue, scriptedExtractor } from "@/test/fixtures";
import { handleVapiWebhook, SECRET_HEADER, secretMatches, type VapiWebhookDeps } from "./vapi-webhook";

const SECRET = "test-webhook-secret-0123456789";

const CALL = {
  message: {
    type: "end-of-call-report",
    call: { id: "call-abc", type: "inboundPhoneCall" },
    customer: { number: "+14155554567" },
    artifact: {
      messages: [
        { role: "assistant", message: "Thanks for calling Workspark maintenance. What's going on?" },
        { role: "user", message: "This is 2D. My bedroom window won't close all the way." },
      ],
    },
  },
};

function setup(saveResult: "saved" | "duplicate" = "saved") {
  const saved: TriageResult[] = [];
  const tasks: Array<() => Promise<void>> = [];
  const store: TriageStore = {
    saveTriage: vi.fn(async (result: TriageResult) => {
      saved.push(result);
      return saveResult === "duplicate" ? null : { report: { ...result.report, id: "r1", created_at: "" }, workOrders: [] };
    }),
    allowIntake: vi.fn(async () => true),
    updateStatus: vi.fn(async () => null),
  };
  const extractor = scriptedExtractor([
    makeExtraction([
      makeIssue({
        issue_type: "Structural",
        priority: "Low",
        unit: "2D",
        area: "bedroom",
        summary: "Bedroom window won't close fully.",
        source_quote: "My bedroom window won't close all the way",
      }),
    ]),
  ]);
  const deps: VapiWebhookDeps = { secret: SECRET, store, extract: extractor.extract, defer: (task) => tasks.push(task) };
  return { deps, saved, tasks, extractor };
}

function post(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers[SECRET_HEADER] = secret;
  return new Request("http://localhost/api/webhooks/vapi", { method: "POST", headers, body: JSON.stringify(body) });
}

describe("secretMatches", () => {
  it("accepts only the exact secret", () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(`${SECRET}x`, SECRET)).toBe(false);
    expect(secretMatches("", SECRET)).toBe(false);
    expect(secretMatches(null, SECRET)).toBe(false);
  });
});

describe("POST /api/webhooks/vapi", () => {
  it("rejects a missing or wrong secret without doing any work", async () => {
    const { deps, tasks } = setup();
    expect((await handleVapiWebhook(post(CALL, null), deps)).status).toBe(401);
    expect((await handleVapiWebhook(post(CALL, "wrong"), deps)).status).toBe(401);
    expect(tasks).toHaveLength(0);
  });

  it("acknowledges other server messages and ignores them", async () => {
    const { deps, tasks } = setup();
    const response = await handleVapiWebhook(post({ message: { type: "status-update" } }), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, action: "ignored", reason: "not_end_of_call" });
    expect(tasks).toHaveLength(0);
  });

  it("answers at once and triages the call afterwards", async () => {
    const { deps, saved, tasks, extractor } = setup();
    const response = await handleVapiWebhook(post(CALL), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, action: "queued" });
    expect(extractor.callCount()).toBe(0);

    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.report).toMatchObject({
      source: "phone",
      caller_last4: "4567",
      vapi_call_id: "call-abc",
    });
    expect(saved[0]?.report.raw_text).toContain("Caller: This is 2D.");
    expect(saved[0]?.tickets[0]).toMatchObject({ issue_type: "Structural", unit: "2D" });
  });

  it("treats a repeated delivery of the same call as already handled", async () => {
    const { deps, tasks } = setup("duplicate");
    await handleVapiWebhook(post(CALL), deps);
    await expect(tasks[0]?.()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run src/lib/api/vapi-webhook.test.ts`
Expected: FAIL. The module `./vapi-webhook` does not exist.

- [ ] **Step 3: Implement `src/lib/api/vapi-webhook.ts`**

```ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/api/vapi-webhook.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Share the extractor and add `getVapiDeps` in `src/lib/api/deps.ts`**

Replace the file with:

```ts
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
```

- [ ] **Step 6: Create the route `src/app/api/webhooks/vapi/route.ts`**

```ts
import { after } from "next/server";
import { getVapiDeps } from "@/lib/api/deps";
import { withErrorBoundary } from "@/lib/api/http";
import { handleVapiWebhook } from "@/lib/api/vapi-webhook";

export const maxDuration = 60;

export const POST = withErrorBoundary((req: Request) =>
  handleVapiWebhook(req, getVapiDeps((task) => after(task))),
);
```

- [ ] **Step 7: Update the Vapi block of `.env.example`**

Replace the lines from `# Vapi —` through `VAPI_WEBHOOK_SECRET=` with:

```
# Vapi — https://dashboard.vapi.ai → Organization → API Keys
# Private key: used only by `pnpm vapi:setup`. Never add it to Vercel.
VAPI_PRIVATE_KEY=
# Public key for the browser call. Restrict it in the Vapi dashboard to this app's assistant
# and to the site's origins (production URL and http://localhost:3000).
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
# Printed by `pnpm vapi:setup`.
NEXT_PUBLIC_VAPI_ASSISTANT_ID=
NEXT_PUBLIC_VAPI_PHONE_NUMBER=
VAPI_CREDENTIAL_ID=
VAPI_PHONE_NUMBER_ID=
# Long random string. `pnpm vapi:setup` stores it in a Vapi webhook credential, and Vapi sends it
# back in the x-vapi-secret header on every webhook.
VAPI_WEBHOOK_SECRET=
```

- [ ] **Step 8: Run the gates**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all clean; the test count rises by 12 over the start of this plan.

- [ ] **Step 9: Commit**

```bash
pnpm format
git add src/lib/api/vapi-webhook.ts src/lib/api/vapi-webhook.test.ts src/app/api/webhooks/vapi/route.ts src/lib/api/deps.ts .env.example
git commit -m "Receive Vapi end-of-call webhooks and triage the transcript" -m "The route checks the shared secret in constant time, answers 200 at once and runs the model in after(), so a slow extraction never times out Vapi's request. A repeated call id is ignored by the existing unique constraint." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Assistant definition and setup script

**Files:**
- Create: `src/lib/vapi/assistant-config.ts`
- Test: `src/lib/vapi/assistant-config.test.ts`
- Create: `scripts/vapi-setup.ts`
- Modify: `package.json` (add the `vapi:setup` script)

**Interfaces:**
- Produces:
  - `ASSISTANT_NAME = "test"`, `APP_TAG = "workspark-maintenance"`, `PHONE_NAME = "Workspark test line"`, `MAX_CALL_SECONDS = 120`
  - `buildAssistantConfig(input: { serverUrl: string; credentialId: string }): AssistantConfig`
  - `isOwnAssistant(assistant: unknown): boolean`
  - `isOwnPhoneNumber(phone: unknown): boolean`
  - `pnpm vapi:setup --server-url <https url>`, which prints `KEY=value` lines for `VAPI_CREDENTIAL_ID`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID` and `NEXT_PUBLIC_VAPI_PHONE_NUMBER`

**This task writes and tests the script. It does not run it.** Running it creates resources in Rafael's business org, so it happens in Task 5 with his go-ahead.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildAssistantConfig, isOwnAssistant, isOwnPhoneNumber, MAX_CALL_SECONDS } from "./assistant-config";

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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run src/lib/vapi/assistant-config.test.ts`
Expected: FAIL. The module `./assistant-config` does not exist.

- [ ] **Step 3: Implement `src/lib/vapi/assistant-config.ts`**

```ts
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
    endCallMessage: "Thanks. Your report is logged and the maintenance team can see it now. Goodbye.",
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/vapi/assistant-config.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write `scripts/vapi-setup.ts`**

```ts
import { z } from "zod";
import { requireEnv } from "@/lib/env";
import { SECRET_HEADER } from "@/lib/api/vapi-webhook";
import {
  buildAssistantConfig,
  isOwnAssistant,
  isOwnPhoneNumber,
  PHONE_NAME,
} from "@/lib/vapi/assistant-config";

const API = "https://api.vapi.ai";
const idSchema = z.object({ id: z.string().min(1) });
const phoneSchema = z.object({ id: z.string().min(1), number: z.string().optional(), status: z.string().optional() });

async function vapi(path: string, init: { method: string; body?: unknown }): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${requireEnv("VAPI_PRIVATE_KEY")}`,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method} ${path} answered ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function serverUrlArg(): string {
  const index = process.argv.indexOf("--server-url");
  const url = index === -1 ? undefined : process.argv[index + 1];
  if (!url?.startsWith("https://")) {
    throw new Error("Pass --server-url https://<host>/api/webhooks/vapi (Vapi needs a public https URL).");
  }
  return url;
}

async function syncCredential(): Promise<string> {
  const authenticationPlan = {
    type: "bearer",
    token: requireEnv("VAPI_WEBHOOK_SECRET"),
    headerName: SECRET_HEADER,
    bearerPrefixEnabled: false,
  };
  const existing = process.env.VAPI_CREDENTIAL_ID;
  if (existing) {
    await vapi(`/credential/${existing}`, { method: "PATCH", body: { authenticationPlan } });
    return existing;
  }
  const created = idSchema.parse(
    await vapi("/credential", {
      method: "POST",
      body: { provider: "webhook", name: "workspark-maintenance webhook", authenticationPlan },
    }),
  );
  return created.id;
}

async function syncAssistant(serverUrl: string, credentialId: string): Promise<string> {
  const config = buildAssistantConfig({ serverUrl, credentialId });
  const existing = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  if (existing) {
    const current = await vapi(`/assistant/${existing}`, { method: "GET" });
    if (!isOwnAssistant(current)) {
      throw new Error(`Assistant ${existing} is not this app's assistant. Refusing to change it.`);
    }
    await vapi(`/assistant/${existing}`, { method: "PATCH", body: config });
    return existing;
  }
  return idSchema.parse(await vapi("/assistant", { method: "POST", body: config })).id;
}

async function syncPhoneNumber(assistantId: string): Promise<z.infer<typeof phoneSchema>> {
  const existing = process.env.VAPI_PHONE_NUMBER_ID;
  if (existing) {
    const current = await vapi(`/phone-number/${existing}`, { method: "GET" });
    if (!isOwnPhoneNumber(current)) {
      throw new Error(`Phone number ${existing} is not this app's number. Refusing to change it.`);
    }
    return phoneSchema.parse(
      await vapi(`/phone-number/${existing}`, { method: "PATCH", body: { assistantId } }),
    );
  }
  return phoneSchema.parse(
    await vapi("/phone-number", {
      method: "POST",
      body: { provider: "vapi", name: PHONE_NAME, assistantId },
    }),
  );
}

async function main(): Promise<void> {
  const serverUrl = serverUrlArg();
  const credentialId = await syncCredential();
  const assistantId = await syncAssistant(serverUrl, credentialId);
  const phone = await syncPhoneNumber(assistantId);

  console.log("Add or update these lines in .env.local (IDs only, no secrets):\n");
  console.log(`VAPI_CREDENTIAL_ID=${credentialId}`);
  console.log(`NEXT_PUBLIC_VAPI_ASSISTANT_ID=${assistantId}`);
  console.log(`VAPI_PHONE_NUMBER_ID=${phone.id}`);
  console.log(`NEXT_PUBLIC_VAPI_PHONE_NUMBER=${phone.number ?? ""}`);
  if (!phone.number) {
    console.log(`\nThe number is ${phone.status ?? "activating"}. Run this again in a few minutes to print it.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

Notes for the implementer:
- `JSON.parse` returns `any`. That value is passed straight into `unknown`-typed APIs (`idSchema.parse` and the guards), so no `any` leaks.
- `SECRET_HEADER` is imported from the webhook module, so the header name has one source.
- The script must not import anything that pulls in `server-only` (the webhook module doesn't).

- [ ] **Step 6: Add the npm script to `package.json`**

In `"scripts"`, after `"seed:demo"`, add:

```json
"vapi:setup": "tsx --env-file=.env.local scripts/vapi-setup.ts"
```

- [ ] **Step 7: Check the script compiles and refuses bad input**

Run: `pnpm typecheck && pnpm vapi:setup`
Expected: typecheck clean; the script exits 1 with `Pass --server-url https://<host>/api/webhooks/vapi …`. It makes no network call, because the argument check runs first.

- [ ] **Step 8: Commit**

```bash
pnpm format
git add src/lib/vapi/assistant-config.ts src/lib/vapi/assistant-config.test.ts scripts/vapi-setup.ts package.json
git commit -m "Define the Vapi intake assistant and an idempotent setup script" -m "The Vapi org also holds client assistants, so the script only touches resources by the IDs it stored, and checks the assistant's name and metadata tag before every change. Calls stop at two minutes with recording off." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: "Call intake" in the dashboard

**Files:**
- Create: `src/lib/voice/call-state.ts`
- Test: `src/lib/voice/call-state.test.ts`
- Create: `src/hooks/use-vapi-call.ts`
- Create: `src/components/intake/call-intake.tsx`
- Modify: `src/components/intake/intake-panel.tsx` (render `<CallIntake />`)
- Modify: `package.json` and `pnpm-lock.yaml` (`pnpm add @vapi-ai/web@3.0.1 --save-exact`)

**Interfaces:**
- Produces:
  - `type CallState = { kind: "idle" } | { kind: "connecting" } | { kind: "live"; startedAt: number; agentSpeaking: boolean } | { kind: "ending" } | { kind: "ended" } | { kind: "error"; message: string }`
  - `type CallEvent = { type: "start" } | { type: "connected"; at: number } | { type: "agent-speech"; speaking: boolean } | { type: "hang-up" } | { type: "ended" } | { type: "failed"; message: string }`
  - `callReducer(state: CallState, event: CallEvent): CallState`
  - `formatElapsed(ms: number): string`
  - `describeCallError(error: unknown): string`
  - `useVapiCall(publicKey: string, assistantId: string): { state: CallState; elapsedMs: number; start: () => void; hangUp: () => void }`
  - `CallIntake()`, which renders nothing when `NEXT_PUBLIC_VAPI_PUBLIC_KEY` or `NEXT_PUBLIC_VAPI_ASSISTANT_ID` is unset

Vapi Web SDK 3.0.1 facts:
- `new Vapi(publicKey)`;
- `start(assistantId): Promise<Call | null>`;
- `stop(): Promise<void>`;
- events `call-start`, `call-end`, `speech-start`, `speech-end` (the **assistant** starts or stops talking) and `error` (`(error: any)`).

Load the SDK with `await import("@vapi-ai/web")` inside the click handler, so it never runs during server rendering.

- [ ] **Step 1: Write the failing test**

```ts
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

  it("keeps the error when the SDK reports call-end after a failure", () => {
    const failed = callReducer({ kind: "connecting" }, { type: "failed", message: "No mic" });
    expect(callReducer(failed, { type: "ended" })).toBe(failed);
  });

  it("can start again after a call ended or failed", () => {
    expect(callReducer({ kind: "ended" }, { type: "start" })).toEqual({ kind: "connecting" });
    expect(callReducer({ kind: "error", message: "x" }, { type: "start" })).toEqual({ kind: "connecting" });
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
    expect(describeCallError({ error: { message: "Permission denied by system" } })).toMatch(/microphone/i);
  });

  it("falls back to a generic message", () => {
    expect(describeCallError({ type: "daily-error" })).toMatch(/could not connect/i);
    expect(describeCallError(undefined)).toMatch(/could not connect/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run src/lib/voice/call-state.test.ts`
Expected: FAIL. The module `./call-state` does not exist.

- [ ] **Step 3: Implement `src/lib/voice/call-state.ts`**

```ts
export type CallState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "live"; startedAt: number; agentSpeaking: boolean }
  | { kind: "ending" }
  | { kind: "ended" }
  | { kind: "error"; message: string };

export type CallEvent =
  | { type: "start" }
  | { type: "connected"; at: number }
  | { type: "agent-speech"; speaking: boolean }
  | { type: "hang-up" }
  | { type: "ended" }
  | { type: "failed"; message: string };

const MIC_BLOCKED =
  "Microphone access is blocked. Allow it for this site in the browser, then try again.";
const CALL_FAILED = "The call could not connect. Try again, or dial the number below.";

export function callReducer(state: CallState, event: CallEvent): CallState {
  switch (event.type) {
    case "start":
      return state.kind === "connecting" || state.kind === "live" ? state : { kind: "connecting" };
    case "connected":
      return state.kind === "connecting"
        ? { kind: "live", startedAt: event.at, agentSpeaking: false }
        : state;
    case "agent-speech":
      return state.kind === "live" ? { ...state, agentSpeaking: event.speaking } : state;
    case "hang-up":
      return state.kind === "live" || state.kind === "connecting" ? { kind: "ending" } : state;
    case "ended":
      return state.kind === "error" ? state : { kind: "ended" };
    case "failed":
      return { kind: "error", message: event.message };
  }
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error !== "object" || error === null) return String(error);
  return Object.values(error)
    .map((value) => (typeof value === "object" && value !== null ? errorText(value) : String(value)))
    .join(" ");
}

export function describeCallError(error: unknown): string {
  return /NotAllowed|permission/i.test(errorText(error)) ? MIC_BLOCKED : CALL_FAILED;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/voice/call-state.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the SDK**

Run: `pnpm add @vapi-ai/web@3.0.1 --save-exact`
Expected: `package.json` lists `"@vapi-ai/web": "3.0.1"`. If pnpm refuses because of release age, a transitive `@daily-co/daily-js` is too new. Add that exact version to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`, as was done for the Supabase packages, and say so in the report.

- [ ] **Step 6: Write the hook `src/hooks/use-vapi-call.ts`**

```ts
"use client";

import type Vapi from "@vapi-ai/web";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { callReducer, describeCallError, type CallState } from "@/lib/voice/call-state";

export function useVapiCall(publicKey: string, assistantId: string) {
  const [state, dispatch] = useReducer(callReducer, { kind: "idle" } satisfies CallState);
  const [now, setNow] = useState(0);
  const clientRef = useRef<Vapi | null>(null);

  useEffect(() => {
    if (state.kind !== "live") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state.kind]);

  useEffect(() => () => void clientRef.current?.stop(), []);

  const connect = useCallback(async (): Promise<Vapi> => {
    if (clientRef.current) return clientRef.current;
    const { default: VapiClient } = await import("@vapi-ai/web");
    const client = new VapiClient(publicKey);
    client.on("call-start", () => dispatch({ type: "connected", at: Date.now() }));
    client.on("speech-start", () => dispatch({ type: "agent-speech", speaking: true }));
    client.on("speech-end", () => dispatch({ type: "agent-speech", speaking: false }));
    client.on("call-end", () => dispatch({ type: "ended" }));
    client.on("error", (error: unknown) =>
      dispatch({ type: "failed", message: describeCallError(error) }),
    );
    clientRef.current = client;
    return client;
  }, [publicKey]);

  const start = useCallback(() => {
    dispatch({ type: "start" });
    connect()
      .then((client) => client.start(assistantId))
      .catch((error: unknown) => dispatch({ type: "failed", message: describeCallError(error) }));
  }, [assistantId, connect]);

  const hangUp = useCallback(() => {
    dispatch({ type: "hang-up" });
    void clientRef.current?.stop();
  }, []);

  const elapsedMs = state.kind === "live" ? Math.max(0, now - state.startedAt) : 0;
  return { state, elapsedMs, start, hangUp };
}
```

Notes:
- `satisfies` is not a type assertion, so it is allowed.
- The `.catch` handles one specific failure (the call could not start), so it is not a blanket catch.
- If `import type Vapi from "@vapi-ai/web"` does not resolve as a class type, use `InstanceType<typeof import("@vapi-ai/web").default>`, and say so in the report.
- `pnpm lint` has had zero warnings so far, so keep it that way. If `react-hooks/exhaustive-deps` warns about reading `clientRef.current` in the unmount cleanup, stop the call from a `useEffect` whose cleanup captures the client when it is created, rather than silencing the rule.

- [ ] **Step 7: Write `src/components/intake/call-intake.tsx`**

The rules come first; the code follows.
- The section sits under the sample chips, separated by `border-t border-line pt-4 mt-4`.
- Its eyebrow label is "Or call it in", in the same style as "Try one of the sample reports".
- **Idle:** a secondary full-width Button with `PhoneIcon` and the text "Call intake". The helper text under it: "Talk to the intake assistant in your browser. Calls end after 2 minutes."
- **Connecting:** the same button with `aria-busy` and the text "Connecting…". Clicks do nothing.
- **Live:** a row with a 10 px `bg-accent` dot that pulses only under `motion-safe`, the text "Agent speaking" or "Listening", and a mono timer "0:42 / 2:00" (`font-mono tabular-nums`). Under it, a primary Button with `PhoneDisconnectIcon` and the text "End call". It is ink, **not red**.
- **Ending:** the text "Ending call…".
- **Ended:** the text "Call ended. The ticket appears in the list within a few seconds." and a secondary "Call again" button.
- **Error:** `WarningCircleIcon` in `text-ink-muted` (not red) with the message, and a secondary "Try again" button.
- State text sits in one `role="status"` region, so screen readers hear the changes.
- When `NEXT_PUBLIC_VAPI_PHONE_NUMBER` is set, show "Or dial" followed by a `tel:` link to the number (`font-mono`). The href keeps only `+` and digits.
- Verify `PhoneIcon`, `PhoneDisconnectIcon` and `WarningCircleIcon` exist in `node_modules/@phosphor-icons/react/dist/ssr/*.d.ts`, and import from `@phosphor-icons/react/dist/ssr` as `intake-panel.tsx` does.

```tsx
"use client";

import { PhoneDisconnectIcon, PhoneIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { useVapiCall } from "@/hooks/use-vapi-call";
import { formatElapsed, type CallState } from "@/lib/voice/call-state";
import { MAX_CALL_SECONDS } from "@/lib/vapi/assistant-config";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "";
const PHONE_NUMBER = process.env.NEXT_PUBLIC_VAPI_PHONE_NUMBER ?? "";
const LIMIT = formatElapsed(MAX_CALL_SECONDS * 1000);

function statusText(state: CallState, elapsed: string): string {
  switch (state.kind) {
    case "idle":
      return "Talk to the intake assistant in your browser. Calls end after 2 minutes.";
    case "connecting":
      return "Connecting…";
    case "live":
      return `${state.agentSpeaking ? "Agent speaking" : "Listening"} · ${elapsed} / ${LIMIT}`;
    case "ending":
      return "Ending call…";
    case "ended":
      return "Call ended. The ticket appears in the list within a few seconds.";
    case "error":
      return state.message;
  }
}

function CallControls({ publicKey, assistantId }: { publicKey: string; assistantId: string }) {
  const { state, elapsedMs, start, hangUp } = useVapiCall(publicKey, assistantId);
  const live = state.kind === "live";
  const busy = state.kind === "connecting" || state.kind === "ending";

  return (
    <div className="space-y-2">
      {live ? (
        <Button className="w-full" onClick={hangUp}>
          <PhoneDisconnectIcon size={18} aria-hidden />
          End call
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="w-full"
          aria-busy={busy}
          onClick={busy ? undefined : start}
        >
          <PhoneIcon size={18} aria-hidden />
          {state.kind === "connecting"
            ? "Connecting…"
            : state.kind === "ended"
              ? "Call again"
              : state.kind === "error"
                ? "Try again"
                : "Call intake"}
        </Button>
      )}
      <p role="status" className="flex items-start gap-2 text-xs text-ink-muted">
        {live && (
          <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-full bg-accent motion-safe:animate-pulse" />
        )}
        {state.kind === "error" && <WarningCircleIcon size={16} aria-hidden className="shrink-0" />}
        <span className={live ? "font-mono tabular-nums text-ink" : undefined}>
          {statusText(state, formatElapsed(elapsedMs))}
        </span>
      </p>
    </div>
  );
}

export function CallIntake() {
  if (!PUBLIC_KEY || !ASSISTANT_ID) return null;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="mb-2 text-xs text-ink-muted">Or call it in</p>
      <CallControls publicKey={PUBLIC_KEY} assistantId={ASSISTANT_ID} />
      {PHONE_NUMBER && (
        <p className="mt-3 text-xs text-ink-muted">
          Or dial{" "}
          <a
            href={`tel:${PHONE_NUMBER.replace(/[^+\d]/g, "")}`}
            className="font-mono text-ink underline-offset-2 hover:underline"
          >
            {PHONE_NUMBER}
          </a>
        </p>
      )}
    </div>
  );
}
```

- **Import boundary:** `src/lib/vapi/assistant-config.ts` imports only `zod`, so it is safe to import in a client component. Do not add server-only imports to it.
- **Nested ternary:** if `react/no-nested-ternary` or readability objects to the button label, move it into a small `buttonLabel(state)` function next to `statusText`.

- [ ] **Step 8: Render it in `src/components/intake/intake-panel.tsx`**

Add `import { CallIntake } from "./call-intake";` beside the other local imports. Put `<CallIntake />` directly after the `<div className="mt-4">` that holds the sample chips, before the `role="status"` result region.

- [ ] **Step 9: Verify in the browser**

The dev server on :3000 must be **restarted by the orchestrator**, not by you, before `NEXT_PUBLIC_VAPI_ASSISTANT_ID` exists locally. Until Task 5 runs the setup script, that variable is unset and `CallIntake` renders nothing. That is the expected result, and it proves the hidden-when-unconfigured path.
- Screenshot the intake panel at 1440 and 375 px under `.superpowers/sdd/p3-t4-*.png`.
- Do not place a real call.

- [ ] **Step 10: Gates and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test` (and `pnpm build` if more than 2 GB is free).
Expected: clean. The build must succeed with `@vapi-ai/web` only in the client bundle.

```bash
pnpm format
git add src/lib/voice/call-state.ts src/lib/voice/call-state.test.ts src/hooks/use-vapi-call.ts src/components/intake/call-intake.tsx src/components/intake/intake-panel.tsx package.json pnpm-lock.yaml
git commit -m "Add a Call intake button that runs a Vapi call in the browser" -m "Reviewers outside the US cannot easily dial the intake number, so the same assistant is reachable from the dashboard. The SDK loads on click, the call state lives in a tested reducer, and the section hides itself when Vapi is not configured." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Go live (orchestrator with Rafael, not a subagent task)

Each step that touches Vapi, Vercel or `main` needs Rafael's go-ahead at the time. Approving this plan approves the steps as listed, but the orchestrator still confirms before Steps 3, 4, 6 and 7.

- [ ] **Step 1: Review and merge.** Run the Sonnet task reviews and the Opus branch review. Open the PR `feat/voice` → `main` after the dashboard PR has merged, and merge with a merge commit. Vercel then deploys `main` to production.
- [ ] **Step 2: Webhook secret in Vercel before the merge deploys.**
  `vercel env add VAPI_WEBHOOK_SECRET production` and `… preview`, with the value piped from `.env.local` and never echoed.
  Then check that `curl -s -o /dev/null -w "%{http_code}" -X POST https://workspark-maintenance.vercel.app/api/webhooks/vapi` returns **401**.
- [ ] **Step 3: Run the setup (Rafael's go-ahead).**
  `pnpm vapi:setup --server-url https://workspark-maintenance.vercel.app/api/webhooks/vapi`
  Copy the four printed lines into `.env.local`. If `POST /credential` is refused, stop and report it; do not fall back to another auth scheme without a decision.
- [ ] **Step 4: Rafael restricts the public key.** In the Vapi dashboard, under API Keys → the public key he created:
  - Allowed Origins: `https://workspark-maintenance.vercel.app` and `http://localhost:3000`
  - Allowed Assistants: `test`
  - Transient Assistant: off

  **Do not continue until he confirms.**
- [ ] **Step 5: Browser env vars.** `vercel env add` `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` and `NEXT_PUBLIC_VAPI_PHONE_NUMBER` for production and preview. They are build-time values, so production needs a redeploy (Rafael runs or approves `vercel deploy --environment production`). Restart the local dev server.
- [ ] **Step 6: Synthetic webhook check.**
  - POST a minimal end-of-call report to production with the `x-vapi-secret` header (read from `.env.local`, never echoed):
    - call id `verify-<unix time>`;
    - type `webCall`;
    - messages: an `assistant` greeting, then `user`: "Hi, this is 3B. The bathroom fan stopped working, no rush."
  - Expect `200 {"action":"queued"}`. Within about 10 s, a `Browser call` report with a Low/Medium Appliance or HVAC ticket for 3B appears on the dashboard.
  - POST the same body again. Expect `200` and still one report for that call id.
  - POST without the header. Expect `401`.
- [ ] **Step 7: Real calls with Rafael.**
  - He clicks Call intake on production, reports "I'm in 7A and I think I smell gas", and hangs up. A Gas Emergency ticket for 7A appears, and the drawer shows the transcript and the source "Browser call".
  - Optionally he dials the number.
  - Capture screenshots for the README.
- [ ] **Step 8: Docs.**
  - **README:**
    - add the voice path to the Mermaid diagram;
    - replace the "Voice intake … is being added now" line with how to try it;
    - list voice limits: US-only inbound number, 2-minute cap, a spoken unit without digits drops to follow-up.
  - **CLAUDE.md:** tick Phase 4.
  - Commit on `main` via a short docs PR.
