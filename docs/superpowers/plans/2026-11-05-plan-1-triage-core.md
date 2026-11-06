# Plan 1 — Triage core: scaffold, pipeline, database, API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementation subagents run on `model: "fable"` (CLAUDE.md decision 5).

**Goal:** A deployed Next.js API that turns a maintenance report into validated, grounded, rule-checked work orders in Supabase, proven on the brief's five sample reports.

**Architecture:** Pure triage modules (`normalize`, `ground`, `rules`, `pipeline`) with the Anthropic call injected as an `Extractor`, so everything except `extract.ts` is tested without the network. Persistence goes through a `TriageStore` interface backed by Supabase (secret key, two Postgres functions). Thin route handlers wire real dependencies; handler logic is tested with fakes.

**Tech Stack:** Next.js 16.4.5 (App Router), React 19.3.1, TypeScript 5.9.3 strict, Zod 4.6.7, `@anthropic-ai/sdk` 1.5.0 (Claude Fable 5.1), `@supabase/supabase-js` 2.119.0, Tailwind 4.3.4, Vitest 5.1.0, pnpm 12.16.1, Node 24.

Spec: `docs/superpowers/specs/2026-11-05-maintenance-triage-design.md`. Later plans: Plan 2 (dashboard UI) and Plan 3 (voice, production polish, README, walkthrough) are written after this plan lands, against the real code.

## Global Constraints

- Exact dependency versions, no `^`/`~`: next 16.4.5, react 19.3.1, react-dom 19.3.1, typescript 5.9.3, zod 4.6.7, @anthropic-ai/sdk 1.5.0, @supabase/supabase-js 2.119.0, server-only 0.0.1, tailwindcss 4.3.4, @tailwindcss/postcss 4.3.4, eslint 10.14.0, eslint-config-next 16.4.5, prettier 3.9.10, vitest 5.1.0, vite 8.3.6, tsx 4.23.15, pg 8.23.1, @types/pg 8.23.1, @types/node 24.19.2, @types/react 19.3.0, @types/react-dom 19.3.0. If ESLint 10 fails to load a plugin from `eslint-config-next`, use eslint 9.39.5 and say so in the commit body.
- `packageManager: "pnpm@12.16.1"`, `engines.node: ">=22"`.
- TypeScript `strict` + `noUncheckedIndexedAccess`; no `any` (explicit or via casts); no non-null assertions in source files (tests may use them).
- Enum strings exactly: issue types `Plumbing | Electrical | HVAC | Appliance | Gas | Structural | Pest | Other`; priorities `Low | Medium | High | Emergency`; statuses `New | In Progress | Done`; sources `text | phone | web_call`; caller urgency `none_stated | low | medium | high | emergency`; missing fields `unit_number | issue_detail`.
- Model: `ANTHROPIC_MODEL` or default `claude-fable-5-1`; `output_config.effort: "low"`; no `thinking` param; `fallbacks: "default"` + beta `server-side-fallback-2026-07-01` only for `claude-fable-5-1`, `claude-opus-5-5`, `claude-opus-5`, `claude-sonnet-5-5`.
- Supabase: new key types only (`sb_publishable_…` in the browser, `sb_secret_…` on the server). RLS on every table. Explicit `GRANT`s (tables are not exposed to the Data API by default since 2026-10-30). No `SECURITY DEFINER` functions.
- Files under ~200 lines, one job each. No comments that narrate code; a short *why* comment is fine. No blanket try/catch — catch only where an error is converted (SDK → `ExtractionError`, JSON parse, one HTTP boundary).
- Before every commit: `pnpm format`, then `git diff --cached` checked for secrets (`sk-ant-`, `sb_secret_`, `sbp_`, UUID-shaped Vapi keys, `postgresql://…:…@`). `.env.local` is never staged.
- Commits: imperative subject ≤ 72 chars, body explains *why* when non-obvious, end with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never "fix", "update", "wip", "changes".
- Shell is Git Bash on Windows; the repo path contains a non-ASCII character and spaces — always quote paths.
- Work on branch `feat/triage-core`. Pull requests are merged with a **merge commit** (not squash) so the small commits stay visible on `main`.

## File map

```
package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts, postcss.config.mjs,
eslint.config.mjs, .prettierrc.json, .prettierignore, vitest.config.ts, vercel.json,
.env.example, .github/workflows/ci.yml                       — toolchain (Task 1)
src/app/layout.tsx, src/app/page.tsx, src/app/globals.css     — placeholder shell (Task 1; Plan 2 replaces page)
src/test/server-only-stub.ts                                  — lets Vitest import server-only modules
src/test/fixtures.ts                                          — shared test builders
src/lib/env.ts                                                — requireEnv()
src/lib/triage/schema.ts      — enums, Zod schemas, structured-output JSON schema, priority helpers
src/lib/triage/types.ts       — drafts, Extractor, ExtractionError
src/lib/triage/samples.ts     — the brief's five reports + expected outcomes
src/lib/triage/normalize.ts   — input clean-up and limits
src/lib/triage/ground.ts      — unit / quote grounding
src/lib/triage/rules.ts       — safety escalation rules
src/lib/triage/prompt.ts      — system prompt, PROMPT_VERSION, user message builder
src/lib/triage/pipeline.ts    — runTriage()
src/lib/triage/extract.ts     — Anthropic extractor (server-only)
src/lib/triage/eval-check.ts  — compares results to samples, renders the results table
src/lib/db/types.ts, store.ts, server-store.ts                — persistence
src/lib/api/http.ts, client-ip.ts, create-report.ts, update-status.ts, deps.ts
src/app/api/reports/route.ts, src/app/api/work-orders/[id]/route.ts
supabase/migrations/20261105000000_init.sql
scripts/db-migrate.ts, scripts/eval.ts
docs/walkthrough.md           — results table written by `pnpm eval`
```

---

### Task 1: Clean history, scaffold the toolchain, add CI

**Files:**
- Modify: `.gitignore`, `CLAUDE.md`
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `src/test/server-only-stub.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `vercel.json`, `.env.example`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: scripts `dev`, `build`, `lint`, `typecheck`, `format`, `format:check`, `test`, `eval`, `db:migrate`; `@/*` → `src/*` alias in TS and Vitest; `server-only` stubbed in Vitest.

- [ ] **Step 1: Rewrite the unpushed root commit so the old CLAUDE.md never reaches GitHub**

The first local commit contains a CLAUDE.md revision with personal file names. Nothing has been pushed, so fold both existing commits into one.

```bash
cd "<repo>"
git status --short            # must be empty
ROOT=$(git rev-list --max-parents=0 HEAD)
git reset --soft "$ROOT"
git commit --amend -q -F - <<'EOF'
Add project handoff, decisions and design spec

The brief's requirements, the decisions Rafael made on 2026-11-05, the
design spec, and CLAUDE.md for future sessions. The brief itself stays
out of the repo.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git log --oneline                                   # exactly one commit
git ls-files '*.pdf' '*.docx'                       # expected: no output
git checkout -b feat/triage-core
```

- [ ] **Step 2: Extend `.gitignore`**

Append:

```gitignore

# Next.js and tooling
next-env.d.ts
*.tsbuildinfo
.vercel/
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "workspark-maintenance",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.16.1",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "next typegen && tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "eval": "tsx --conditions=react-server --env-file=.env.local scripts/eval.ts",
    "db:migrate": "tsx --env-file=.env.local scripts/db-migrate.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "1.5.0",
    "@supabase/supabase-js": "2.119.0",
    "next": "16.4.5",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "server-only": "0.0.1",
    "zod": "4.6.7"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.4",
    "@types/node": "24.19.2",
    "@types/pg": "8.23.1",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "eslint": "10.14.0",
    "eslint-config-next": "16.4.5",
    "pg": "8.23.1",
    "prettier": "3.9.10",
    "tailwindcss": "4.3.4",
    "tsx": "4.23.15",
    "typescript": "5.9.3",
    "vite": "8.3.6",
    "vitest": "5.1.0"
  }
}
```

`--conditions=react-server` makes `import "server-only"` resolve to its empty server build when scripts run under tsx.

- [ ] **Step 4: Create the TypeScript, Next, PostCSS, ESLint, Prettier and Vitest configs**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
```

`postcss.config.mjs`:

```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);
```

`.prettierrc.json`:

```json
{
  "printWidth": 100
}
```

`.prettierignore`:

```
pnpm-lock.yaml
.next
*.md
docs
supabase
```

`vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
```

`src/test/server-only-stub.ts`:

```ts
export {};
```

- [ ] **Step 5: Create the placeholder app shell**

`src/app/globals.css`:

```css
@import "tailwindcss";
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workspark Maintenance",
  description: "Maintenance reports in, triaged work orders out.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Workspark Maintenance</h1>
      <p className="mt-2 text-sm">
        The triage API is live at <code>POST /api/reports</code>. The dashboard arrives in the next
        phase.
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Install and verify the empty toolchain**

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

Expected: install completes (warnings about ignored build scripts for optional packages such as `sharp` are fine — do not approve them); every command exits 0; `vitest` reports "No test files found, exiting with code 0"; `next build` lists `/` as static.

If ESLint throws while loading a plugin, set `"eslint": "9.39.5"`, `pnpm install`, rerun.

- [ ] **Step 7: Commit the scaffold**

```bash
pnpm format
git add .gitignore package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs .prettierrc.json .prettierignore vitest.config.ts src/
git diff --cached --stat
git commit -q -F - <<'EOF'
Scaffold Next.js app with strict TypeScript and Vitest

Hand-written rather than create-next-app: the generator refuses a
non-empty folder and adds starter assets we would delete anyway.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 8: Add CI, the env template and the Vercel region**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm test
```

`.env.example`:

```bash
# Copy to .env.local and fill in. Never commit real values.

# Anthropic — https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
# Optional. Defaults to claude-fable-5-1.
ANTHROPIC_MODEL=

# Supabase — Dashboard → Project Settings → API Keys
NEXT_PUBLIC_SUPABASE_URL=
# Publishable key (sb_publishable_…). Safe in the browser; RLS limits it to reads.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Secret key (sb_secret_…). Server only.
SUPABASE_SECRET_KEY=
# Session pooler connection string. Used only by `pnpm db:migrate`.
DATABASE_URL=

# Vapi — https://dashboard.vapi.ai → Organization → API Keys
VAPI_PRIVATE_KEY=
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
NEXT_PUBLIC_VAPI_ASSISTANT_ID=
NEXT_PUBLIC_VAPI_PHONE_NUMBER=
# Long random string; must match the secret configured on the Vapi assistant.
VAPI_WEBHOOK_SECRET=

# Long random string; salts the hash of client IPs for rate limiting.
RATE_LIMIT_SALT=
```

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["icn1"]
}
```

- [ ] **Step 9: Record commands and merge strategy in CLAUDE.md**

In `CLAUDE.md`, replace the `## Commands` section body with:

```markdown
`pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm format` ·
`pnpm eval` (five sample reports against the real model; `--persist` also saves them) ·
`pnpm db:migrate` (applies `supabase/migrations/*.sql` via `DATABASE_URL`).
```

and in the **Branches and PRs** paragraph replace "Squash-merge to `main`." with "Merge with a merge commit so the small commits stay visible on `main`."

- [ ] **Step 10: Commit**

```bash
pnpm format
git add .github/workflows/ci.yml .env.example vercel.json CLAUDE.md
git commit -q -F - <<'EOF'
Add CI workflow, env template and Seoul function region

Functions run in icn1 because the Supabase project lives in
ap-northeast-2; each request makes several database round trips.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Triage vocabulary — enums, schemas, sample reports

**Files:**
- Create: `src/lib/triage/schema.ts`, `src/lib/triage/types.ts`, `src/lib/triage/samples.ts`
- Test: `src/lib/triage/schema.test.ts`

**Interfaces:**
- Produces (`schema.ts`): consts `ISSUE_TYPES`, `PRIORITIES`, `STATUSES`, `SOURCES`, `CALLER_URGENCIES`, `MISSING_FIELDS`, `RULE_NAMES`, `GROUNDING_NOTES`; types `IssueType`, `Priority`, `Status`, `Source`, `CallerUrgency`, `MissingField`, `RuleName`, `GroundingNote`, `ExtractedIssue`, `Extraction`; Zod `extractedIssueSchema`, `extractionSchema`; `EXTRACTION_JSON_SCHEMA`; `priorityRank(p: Priority): number`; `higherPriority(a: Priority, b: Priority): Priority`.
- Produces (`types.ts`): `PrioritySource`, `TriageInput`, `TicketDraft`, `ReportDraft`, `TriageResult`, `ExtractorResult`, `Extractor`, `ExtractionFailure`, class `ExtractionError(message, kind)`.
- Produces (`samples.ts`): `SAMPLE_REPORTS: readonly SampleReport[]` with `id` `r1`…`r5`, `label`, `text`, `expected: readonly ExpectedTicket[]`.

- [ ] **Step 1: Write the failing drift test**

`src/lib/triage/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EXTRACTION_JSON_SCHEMA, extractedIssueSchema, extractionSchema } from "./schema";

describe("structured-output JSON schema", () => {
  it("requires every field the Zod issue schema expects", () => {
    const zodKeys = Object.keys(extractedIssueSchema.shape).sort();
    const items = EXTRACTION_JSON_SCHEMA.properties.issues.items;
    expect(Object.keys(items.properties).sort()).toEqual(zodKeys);
    expect([...items.required].sort()).toEqual(zodKeys);
  });

  it("requires every top-level field the Zod extraction schema expects", () => {
    const zodKeys = Object.keys(extractionSchema.shape).sort();
    expect(Object.keys(EXTRACTION_JSON_SCHEMA.properties).sort()).toEqual(zodKeys);
    expect([...EXTRACTION_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/triage/schema.test.ts`
Expected: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 3: Write `schema.ts`**

```ts
import { z } from "zod";

export const ISSUE_TYPES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Gas",
  "Structural",
  "Pest",
  "Other",
] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Emergency"] as const;
export const STATUSES = ["New", "In Progress", "Done"] as const;
export const SOURCES = ["text", "phone", "web_call"] as const;
export const CALLER_URGENCIES = ["none_stated", "low", "medium", "high", "emergency"] as const;
export const MISSING_FIELDS = ["unit_number", "issue_detail"] as const;
export const RULE_NAMES = [
  "gas_odor",
  "water_electrical",
  "fire_smoke",
  "flooding",
  "no_heat_cold",
] as const;
export const GROUNDING_NOTES = ["unit_not_in_report", "quote_not_in_report"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type CallerUrgency = (typeof CALLER_URGENCIES)[number];
export type MissingField = (typeof MISSING_FIELDS)[number];
export type RuleName = (typeof RULE_NAMES)[number];
export type GroundingNote = (typeof GROUNDING_NOTES)[number];

export const extractedIssueSchema = z.strictObject({
  issue_type: z.enum(ISSUE_TYPES),
  priority: z.enum(PRIORITIES),
  priority_rationale: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(20).nullable(),
  area: z.string().trim().max(80).nullable(),
  source_quote: z.string().trim().min(1).max(600),
  missing_fields: z.array(z.enum(MISSING_FIELDS)),
});

export const extractionSchema = z.strictObject({
  caller_stated_urgency: z.enum(CALLER_URGENCIES),
  caller_urgency_quote: z.string().trim().max(300).nullable(),
  issues: z.array(extractedIssueSchema).min(1).max(5),
});

export type ExtractedIssue = z.infer<typeof extractedIssueSchema>;
export type Extraction = z.infer<typeof extractionSchema>;

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

// Hand-written because structured outputs reject length and count keywords; Zod enforces those.
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["caller_stated_urgency", "caller_urgency_quote", "issues"],
  properties: {
    caller_stated_urgency: { type: "string", enum: [...CALLER_URGENCIES] },
    caller_urgency_quote: nullableString,
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "issue_type",
          "priority",
          "priority_rationale",
          "summary",
          "unit",
          "area",
          "source_quote",
          "missing_fields",
        ],
        properties: {
          issue_type: { type: "string", enum: [...ISSUE_TYPES] },
          priority: { type: "string", enum: [...PRIORITIES] },
          priority_rationale: { type: "string" },
          summary: { type: "string" },
          unit: nullableString,
          area: nullableString,
          source_quote: { type: "string" },
          missing_fields: { type: "array", items: { type: "string", enum: [...MISSING_FIELDS] } },
        },
      },
    },
  },
} as const;

const PRIORITY_RANK: Record<Priority, number> = { Low: 0, Medium: 1, High: 2, Emergency: 3 };

export function priorityRank(priority: Priority): number {
  return PRIORITY_RANK[priority];
}

export function higherPriority(a: Priority, b: Priority): Priority {
  return PRIORITY_RANK[b] > PRIORITY_RANK[a] ? b : a;
}
```

- [ ] **Step 4: Write `types.ts`**

```ts
import type {
  CallerUrgency,
  Extraction,
  GroundingNote,
  IssueType,
  MissingField,
  Priority,
  RuleName,
  Source,
} from "./schema";

export type PrioritySource = "model" | "fallback" | `rule:${RuleName}`;

export interface TriageInput {
  text: string;
  source: Source;
  callerLast4: string | null;
  vapiCallId: string | null;
}

export interface TicketDraft {
  position: number;
  issue_type: IssueType;
  priority: Priority;
  model_priority: Priority | null;
  priority_source: PrioritySource;
  priority_reason: string;
  model_rationale: string | null;
  unit: string | null;
  area: string | null;
  summary: string;
  source_quote: string | null;
  missing_fields: MissingField[];
  grounding_notes: GroundingNote[];
  needs_followup: boolean;
}

export interface ReportDraft {
  source: Source;
  raw_text: string;
  caller_last4: string | null;
  vapi_call_id: string | null;
  caller_stated_urgency: CallerUrgency | null;
  caller_urgency_quote: string | null;
  extraction_status: "ok" | "fallback";
  model: string | null;
  prompt_version: string;
  llm_output: Extraction | null;
  latency_ms: number | null;
  error: string | null;
}

export interface TriageResult {
  report: ReportDraft;
  tickets: TicketDraft[];
}

export interface ExtractorResult {
  output: Extraction;
  model: string;
  latencyMs: number;
}

export type Extractor = (input: { text: string; source: Source }) => Promise<ExtractorResult>;

export type ExtractionFailure = "api" | "refusal" | "truncated" | "invalid_output";

export class ExtractionError extends Error {
  readonly kind: ExtractionFailure;

  constructor(message: string, kind: ExtractionFailure) {
    super(message);
    this.name = "ExtractionError";
    this.kind = kind;
  }
}
```

- [ ] **Step 5: Write `samples.ts`**

```ts
import type { IssueType, Priority } from "./schema";
import type { PrioritySource } from "./types";

export interface ExpectedTicket {
  issue_type: IssueType;
  priorities: readonly Priority[];
  unit: string | null;
  needs_followup: boolean;
  priority_source?: PrioritySource;
}

export interface SampleReport {
  id: string;
  label: string;
  text: string;
  expected: readonly ExpectedTicket[];
}

export const SAMPLE_REPORTS: readonly SampleReport[] = [
  {
    id: "r1",
    label: "4B ceiling leak",
    text: "Hi, this is apartment 4B. There is a major water leak coming from the ceiling in the bathroom and it's dripping onto the outlet!",
    expected: [
      {
        issue_type: "Plumbing",
        priorities: ["Emergency"],
        unit: "4B",
        needs_followup: false,
        priority_source: "rule:water_electrical",
      },
    ],
  },
  {
    id: "r2",
    label: "No heat, no unit",
    text: "Hey, the heat isn't working in my place and it's freezing. Can someone come today?",
    expected: [
      {
        issue_type: "HVAC",
        priorities: ["High"],
        unit: null,
        needs_followup: true,
        priority_source: "rule:no_heat_cold",
      },
    ],
  },
  {
    id: "r3",
    label: "12C sink + light",
    text: "Unit 12C here. The kitchen sink is clogged, and also the hallway light outside my door has been flickering for a week.",
    expected: [
      { issue_type: "Plumbing", priorities: ["Medium"], unit: "12C", needs_followup: false },
      { issue_type: "Electrical", priorities: ["Low", "Medium"], unit: "12C", needs_followup: false },
    ],
  },
  {
    id: "r4",
    label: "7A maybe gas",
    text: "Yeah hi, so um, I'm in 7A, and I don't know if it's a big deal, but there's kind of a weird smell near the stove, like maybe gas? My neighbor said it's probably nothing but I wanted to call anyway.",
    expected: [
      {
        issue_type: "Gas",
        priorities: ["Emergency"],
        unit: "7A",
        needs_followup: false,
        priority_source: "rule:gas_odor",
      },
    ],
  },
  {
    id: "r5",
    label: "2D window",
    text: "This is 2D. My bedroom window won't close all the way. Not urgent, whenever you get a chance.",
    expected: [{ issue_type: "Structural", priorities: ["Low"], unit: "2D", needs_followup: false }],
  },
];
```

- [ ] **Step 6: Run the test and typecheck**

Run: `pnpm vitest run src/lib/triage/schema.test.ts && pnpm typecheck`
Expected: 2 tests PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/lib/triage/
git commit -q -F - <<'EOF'
Define the triage vocabulary and the brief's sample reports

The JSON schema sent to the model is written by hand because
structured outputs reject length and count keywords; a test keeps it
in step with the Zod schema that validates the reply.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Input normalization

**Files:**
- Create: `src/lib/triage/normalize.ts`
- Test: `src/lib/triage/normalize.test.ts`

**Interfaces:**
- Produces: `MAX_REPORT_CHARS = 2000`, `MAX_TRANSCRIPT_CHARS = 8000`, `type NormalizeResult = { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" }`, `normalizeReportText(raw: string, maxChars: number): NormalizeResult`.

- [ ] **Step 1: Write the failing tests**

`src/lib/triage/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeReportText } from "./normalize";

describe("normalizeReportText", () => {
  it("trims, collapses spaces and keeps at most one blank line", () => {
    expect(normalizeReportText("  Unit 4B   here.\r\n\r\n\r\nWater   leak  ", 2000)).toEqual({
      ok: true,
      text: "Unit 4B here.\n\nWater leak",
    });
  });

  it("strips control characters", () => {
    expect(normalizeReportText("Unit\u0007 4B\u0000", 2000)).toEqual({ ok: true, text: "Unit 4B" });
  });

  it("rejects input that is empty after clean-up", () => {
    expect(normalizeReportText(" \n\t \u0000", 2000)).toEqual({ ok: false, reason: "empty" });
  });

  it("measures the limit after clean-up", () => {
    expect(normalizeReportText("a".repeat(10) + "    ", 10)).toEqual({ ok: true, text: "a".repeat(10) });
    expect(normalizeReportText("a".repeat(11), 10)).toEqual({ ok: false, reason: "too_long" });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/lib/triage/normalize.test.ts`
Expected: FAIL — cannot resolve `./normalize`.

- [ ] **Step 3: Implement `normalize.ts`**

```ts
export const MAX_REPORT_CHARS = 2000;
export const MAX_TRANSCRIPT_CHARS = 8000;

export type NormalizeResult = { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" };

function isControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code < 32 && char !== "\n" && char !== "\t") || code === 127;
}

export function normalizeReportText(raw: string, maxChars: number): NormalizeResult {
  const text = [...raw.normalize("NFC").replace(/\r\n?/g, "\n")]
    .filter((char) => !isControl(char))
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > maxChars) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `pnpm vitest run src/lib/triage/normalize.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add src/lib/triage/normalize.ts src/lib/triage/normalize.test.ts
git commit -q -m "Normalize report text and enforce length limits" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Grounding checks

**Files:**
- Create: `src/lib/triage/ground.ts`, `src/test/fixtures.ts`
- Test: `src/lib/triage/ground.test.ts`

**Interfaces:**
- Consumes: `Extraction`, `ExtractedIssue`, `MissingField`, `GroundingNote`, `MISSING_FIELDS`, `CallerUrgency` from `schema.ts`; `SAMPLE_REPORTS`.
- Produces (`ground.ts`): `normalizeUnit(raw: string): string`, `unitAppearsIn(unit: string, report: string): boolean`, `quoteAppearsIn(quote: string, report: string): boolean`, `interface GroundedIssue` (an `ExtractedIssue` whose `unit` is normalized or null, `source_quote: string | null`, plus `grounding_notes: GroundingNote[]`), `interface GroundedExtraction { caller_stated_urgency; caller_urgency_quote: string | null; issues: GroundedIssue[] }`, `groundExtraction(extraction: Extraction, report: string): GroundedExtraction`.
- Produces (`fixtures.ts`): `makeIssue(overrides?)`, `makeExtraction(issues, overrides?)`, `sampleText(id)`, `scriptedExtractor(steps)` returning `{ extract: Extractor; callCount: () => number }`.

- [ ] **Step 1: Write the shared fixtures**

`src/test/fixtures.ts`:

```ts
import { SAMPLE_REPORTS } from "@/lib/triage/samples";
import type { ExtractedIssue, Extraction } from "@/lib/triage/schema";
import type { Extractor } from "@/lib/triage/types";

export function makeIssue(overrides: Partial<ExtractedIssue> = {}): ExtractedIssue {
  return {
    issue_type: "Plumbing",
    priority: "Medium",
    priority_rationale: "Impairs normal use of the kitchen.",
    summary: "Kitchen sink is clogged.",
    unit: "12C",
    area: "kitchen",
    source_quote: "The kitchen sink is clogged",
    missing_fields: [],
    ...overrides,
  };
}

export function makeExtraction(
  issues: ExtractedIssue[],
  overrides: Partial<Omit<Extraction, "issues">> = {},
): Extraction {
  return { caller_stated_urgency: "none_stated", caller_urgency_quote: null, issues, ...overrides };
}

export function sampleText(id: string): string {
  const sample = SAMPLE_REPORTS.find((report) => report.id === id);
  if (!sample) throw new Error(`No sample report ${id}`);
  return sample.text;
}

export function scriptedExtractor(steps: Array<Extraction | Error>): {
  extract: Extractor;
  callCount: () => number;
} {
  let calls = 0;
  const extract: Extractor = async () => {
    const step = steps[Math.min(calls, steps.length - 1)];
    calls += 1;
    if (step === undefined) throw new Error("scriptedExtractor needs at least one step");
    if (step instanceof Error) throw step;
    return { output: step, model: "claude-fable-5-1", latencyMs: 1234 };
  };
  return { extract, callCount: () => calls };
}
```

- [ ] **Step 2: Write the failing tests**

`src/lib/triage/ground.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExtraction, makeIssue, sampleText } from "@/test/fixtures";
import { groundExtraction, normalizeUnit, quoteAppearsIn, unitAppearsIn } from "./ground";

describe("unit grounding", () => {
  it("normalizes the common ways a unit is written", () => {
    expect(normalizeUnit("Apt. 4b")).toBe("4B");
    expect(normalizeUnit("#12-C")).toBe("12C");
    expect(normalizeUnit("unit 7A")).toBe("7A");
  });

  it("finds a unit only when the report actually states it", () => {
    expect(unitAppearsIn("4B", sampleText("r1"))).toBe(true);
    expect(unitAppearsIn("apt 7a", sampleText("r4"))).toBe(true);
    expect(unitAppearsIn("3A", sampleText("r2"))).toBe(false);
    expect(unitAppearsIn("2", sampleText("r5"))).toBe(false);
  });
});

describe("quote grounding", () => {
  it("ignores case, spacing, curly apostrophes and edge punctuation", () => {
    expect(quoteAppearsIn("It’s  dripping onto the outlet!", sampleText("r1"))).toBe(true);
  });

  it("rejects words the caller never said", () => {
    expect(quoteAppearsIn("the toilet overflowed", sampleText("r1"))).toBe(false);
  });
});

describe("groundExtraction", () => {
  it("keeps a stated unit in normalized form", () => {
    const grounded = groundExtraction(
      makeExtraction([makeIssue({ unit: "apt 4b", source_quote: "it's dripping onto the outlet" })]),
      sampleText("r1"),
    );
    expect(grounded.issues[0]).toMatchObject({ unit: "4B", missing_fields: [], grounding_notes: [] });
  });

  it("drops an invented unit, asks for follow-up and records why", () => {
    const grounded = groundExtraction(
      makeExtraction([makeIssue({ unit: "3A", source_quote: "the heat isn't working in my place" })]),
      sampleText("r2"),
    );
    expect(grounded.issues[0]).toMatchObject({
      unit: null,
      missing_fields: ["unit_number"],
      grounding_notes: ["unit_not_in_report"],
    });
  });

  it("adds unit_number when the model returns no unit but forgets to flag it", () => {
    const grounded = groundExtraction(
      makeExtraction([makeIssue({ unit: null, source_quote: "the heat isn't working in my place" })]),
      sampleText("r2"),
    );
    expect(grounded.issues[0]?.missing_fields).toEqual(["unit_number"]);
  });

  it("clears unit_number when the unit is grounded", () => {
    const grounded = groundExtraction(
      makeExtraction([makeIssue({ unit: "12C", missing_fields: ["unit_number", "issue_detail"] })]),
      sampleText("r3"),
    );
    expect(grounded.issues[0]?.missing_fields).toEqual(["issue_detail"]);
  });

  it("discards a quote that is not in the report", () => {
    const grounded = groundExtraction(
      makeExtraction([makeIssue({ unit: "4B", source_quote: "the toilet overflowed" })]),
      sampleText("r1"),
    );
    expect(grounded.issues[0]).toMatchObject({
      source_quote: null,
      grounding_notes: ["quote_not_in_report"],
    });
  });

  it("keeps the caller's urgency quote only when it is verbatim", () => {
    const kept = groundExtraction(
      makeExtraction([makeIssue({ unit: "2D", source_quote: "My bedroom window won't close all the way" })], {
        caller_stated_urgency: "low",
        caller_urgency_quote: "Not urgent, whenever you get a chance",
      }),
      sampleText("r5"),
    );
    expect(kept.caller_urgency_quote).toBe("Not urgent, whenever you get a chance");

    const dropped = groundExtraction(
      makeExtraction([makeIssue({ unit: "2D", source_quote: "My bedroom window won't close all the way" })], {
        caller_stated_urgency: "low",
        caller_urgency_quote: "It can wait until next month",
      }),
      sampleText("r5"),
    );
    expect(dropped.caller_urgency_quote).toBeNull();
  });
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `pnpm vitest run src/lib/triage/ground.test.ts`
Expected: FAIL — cannot resolve `./ground`.

- [ ] **Step 4: Implement `ground.ts`**

```ts
import {
  MISSING_FIELDS,
  type CallerUrgency,
  type ExtractedIssue,
  type Extraction,
  type GroundingNote,
  type MissingField,
} from "./schema";

export interface GroundedIssue extends Omit<ExtractedIssue, "unit" | "source_quote"> {
  unit: string | null;
  source_quote: string | null;
  grounding_notes: GroundingNote[];
}

export interface GroundedExtraction {
  caller_stated_urgency: CallerUrgency;
  caller_urgency_quote: string | null;
  issues: GroundedIssue[];
}

const UNIT_PREFIX = /^(UNIT|APARTMENT|APT|SUITE|STE)\b\.?/;

export function normalizeUnit(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/#/g, " ")
    .trim()
    .replace(UNIT_PREFIX, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function unitAppearsIn(unit: string, report: string): boolean {
  const target = normalizeUnit(unit);
  if (target.length === 0) return false;
  const tokens = report.toUpperCase().match(/[A-Z0-9]+(?:-[A-Z0-9]+)?/g) ?? [];
  return tokens.some((token) => token.replace(/-/g, "") === target);
}

function canonical(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function trimEdgePunctuation(text: string): string {
  return text.replace(/^[\s"'.,!?;:]+|[\s"'.,!?;:]+$/g, "");
}

export function quoteAppearsIn(quote: string, report: string): boolean {
  const needle = trimEdgePunctuation(canonical(quote));
  return needle.length > 0 && canonical(report).includes(needle);
}

function groundIssue(issue: ExtractedIssue, report: string): GroundedIssue {
  const notes: GroundingNote[] = [];
  const statedUnit = issue.unit !== null && issue.unit.length > 0 ? issue.unit : null;
  const unitIsGrounded = statedUnit !== null && unitAppearsIn(statedUnit, report);
  if (statedUnit !== null && !unitIsGrounded) notes.push("unit_not_in_report");

  const quoteIsGrounded = quoteAppearsIn(issue.source_quote, report);
  if (!quoteIsGrounded) notes.push("quote_not_in_report");

  const missing = new Set<MissingField>(issue.missing_fields);
  if (unitIsGrounded) missing.delete("unit_number");
  else missing.add("unit_number");

  return {
    ...issue,
    unit: unitIsGrounded && statedUnit !== null ? normalizeUnit(statedUnit) : null,
    source_quote: quoteIsGrounded ? issue.source_quote : null,
    missing_fields: MISSING_FIELDS.filter((field) => missing.has(field)),
    grounding_notes: notes,
  };
}

export function groundExtraction(extraction: Extraction, report: string): GroundedExtraction {
  const urgencyQuote = extraction.caller_urgency_quote;
  return {
    caller_stated_urgency: extraction.caller_stated_urgency,
    caller_urgency_quote:
      urgencyQuote !== null && quoteAppearsIn(urgencyQuote, report) ? urgencyQuote : null,
    issues: extraction.issues.map((issue) => groundIssue(issue, report)),
  };
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `pnpm vitest run src/lib/triage/ground.test.ts`
Expected: 10 tests PASS.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add src/lib/triage/ground.ts src/lib/triage/ground.test.ts src/test/fixtures.ts
git commit -q -F - <<'EOF'
Enforce "never guess" in code: ground units and quotes

A unit survives only if the report states it, and a quote only if it
is a verbatim excerpt. The prompt asks for the same, but the brief
requires the guarantee, so code makes it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Safety escalation rules

**Files:**
- Create: `src/lib/triage/rules.ts`
- Test: `src/lib/triage/rules.test.ts`

**Interfaces:**
- Consumes: `Priority`, `RuleName`, `priorityRank`, `higherPriority` from `schema.ts`.
- Produces: `interface SafetyRule { name: RuleName; floor: Priority; reason: string; test(text: string): boolean }`, `SAFETY_RULES: readonly SafetyRule[]` (order = tie-break order), `matchRules(text: string): SafetyRule[]`, `interface RuleOutcome { priority: Priority; source: "model" | \`rule:${RuleName}\`; reason: string }`, `applySafetyRules(model: { priority: Priority; rationale: string }, text: string): RuleOutcome`.

- [ ] **Step 1: Write the failing tests**

`src/lib/triage/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleText } from "@/test/fixtures";
import { applySafetyRules, matchRules } from "./rules";

const names = (text: string) => matchRules(text).map((rule) => rule.name);

describe("matchRules on the brief's reports", () => {
  it("flags water reaching an outlet (report 1)", () => {
    expect(names(sampleText("r1"))).toContain("water_electrical");
  });

  it("flags no heat in freezing weather (report 2)", () => {
    expect(names(sampleText("r2"))).toEqual(["no_heat_cold"]);
  });

  it("flags a hedged gas smell (report 4)", () => {
    expect(names(sampleText("r4"))).toEqual(["gas_odor"]);
  });

  it("leaves routine problems alone (reports 3 and 5)", () => {
    expect(names(sampleText("r3"))).toEqual([]);
    expect(names(sampleText("r5"))).toEqual([]);
  });
});

describe("matchRules on near misses", () => {
  it.each([
    "The gas stove works fine, but the oven light is out.",
    "Smoke detector keeps chirping, probably the battery.",
    "The water heater is making a banging noise.",
    "The heater works but the AC is not cooling.",
  ])("does not escalate: %s", (text) => {
    expect(names(text)).toEqual([]);
  });

  it.each([
    ["There's smoke coming out of the outlet.", "fire_smoke"],
    ["A pipe burst under the sink and water is pouring out.", "flooding"],
    ["Our CO detector is going off.", "gas_odor"],
    ["The furnace stopped working and it's really cold in here.", "no_heat_cold"],
  ])("escalates: %s", (text, rule) => {
    expect(names(text)).toContain(rule);
  });
});

describe("applySafetyRules", () => {
  it("raises a calm model priority to the rule's floor", () => {
    expect(applySafetyRules({ priority: "Medium", rationale: "unsure" }, "maybe I smell gas")).toEqual({
      priority: "Emergency",
      source: "rule:gas_odor",
      reason: expect.stringContaining("gas odor"),
    });
  });

  it("makes the rule the policy of record when the model already agrees", () => {
    expect(applySafetyRules({ priority: "Emergency", rationale: "gas" }, "smells like gas").source).toBe(
      "rule:gas_odor",
    );
  });

  it("keeps the model's priority when it is above every matched floor", () => {
    expect(
      applySafetyRules(
        { priority: "Emergency", rationale: "elderly tenant, no heat" },
        "the heat isn't working and it's freezing",
      ),
    ).toEqual({ priority: "Emergency", source: "model", reason: "elderly tenant, no heat" });
  });

  it("uses the model's rationale when no rule matches", () => {
    expect(applySafetyRules({ priority: "Low", rationale: "cosmetic" }, "window won't close")).toEqual({
      priority: "Low",
      source: "model",
      reason: "cosmetic",
    });
  });

  it("breaks ties by rule order", () => {
    expect(applySafetyRules({ priority: "Low", rationale: "x" }, "I smell gas and see smoke").source).toBe(
      "rule:gas_odor",
    );
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/lib/triage/rules.test.ts`
Expected: FAIL — cannot resolve `./rules`.

- [ ] **Step 3: Implement `rules.ts`**

```ts
import { higherPriority, priorityRank, type Priority, type RuleName } from "./schema";

export interface SafetyRule {
  readonly name: RuleName;
  readonly floor: Priority;
  readonly reason: string;
  readonly test: (text: string) => boolean;
}

export interface RuleOutcome {
  priority: Priority;
  source: "model" | `rule:${RuleName}`;
  reason: string;
}

const SMELL = /\b(smell|smells|smelled|smelling|odou?rs?)\b/i;
const GAS = /\bgas\b/i;
const GAS_DIRECT = /\b(gas leak|leaking gas|rotten eggs?|carbon monoxide|co (alarm|detector))\b/i;
const WATER = /\b(leak\w*|water|drip\w*|flood\w*)\b/i;
const ELECTRICAL = /\b(outlets?|sockets?|electrical|electric|wiring|wires?|breakers?|panel|sparks?|sparking)\b/i;
const FIRE = /\b(fire|burning smell|smells? (like )?burning|sparks?|sparking)\b/i;
const SMOKE = /\b(smoke|smoky|smoking)\b/i;
const SMOKE_ALARM_CHIRP = /\bsmoke (detector|alarm)s?\b[^.!?]*\b(chirp\w*|beep\w*)/i;
const FLOODING = /\b(flood(ed|ing)?|burst pipe|pipe (has )?burst|water (is )?(pouring|gushing))\b/i;
const HEAT_OUT =
  /\bno heat\b|\b(heat|heater|heating|furnace)\b[^.!?]{0,30}?\b(not|isn['’]t|stopped|broken|out|won['’]t|doesn['’]t|died)\b/i;
const COLD = /\b(freezing|cold|frigid)\b/i;

const sentences = (text: string) => text.split(/[.!?\n]+/);

export const SAFETY_RULES: readonly SafetyRule[] = [
  {
    name: "gas_odor",
    floor: "Emergency",
    reason: "Possible gas odor: treated as an emergency regardless of how the caller described it.",
    test: (text) =>
      GAS_DIRECT.test(text) || sentences(text).some((part) => SMELL.test(part) && GAS.test(part)),
  },
  {
    name: "water_electrical",
    floor: "Emergency",
    reason: "Water is reaching an electrical fixture: shock and fire risk.",
    test: (text) => WATER.test(text) && ELECTRICAL.test(text),
  },
  {
    name: "fire_smoke",
    floor: "Emergency",
    reason: "Fire, smoke, or sparking reported.",
    test: (text) => FIRE.test(text) || (SMOKE.test(text) && !SMOKE_ALARM_CHIRP.test(text)),
  },
  {
    name: "flooding",
    floor: "Emergency",
    reason: "Active flooding: damage spreads by the minute.",
    test: (text) => FLOODING.test(text),
  },
  {
    name: "no_heat_cold",
    floor: "High",
    reason: "No heat in freezing conditions: needs a same-day visit.",
    test: (text) => HEAT_OUT.test(text) && COLD.test(text),
  },
];

export function matchRules(text: string): SafetyRule[] {
  return SAFETY_RULES.filter((rule) => rule.test(text));
}

export function applySafetyRules(
  model: { priority: Priority; rationale: string },
  text: string,
): RuleOutcome {
  const matched = matchRules(text);
  const fromModel: RuleOutcome = { priority: model.priority, source: "model", reason: model.rationale };
  if (matched.length === 0) return fromModel;

  const strongest = matched.reduce((best, rule) =>
    priorityRank(rule.floor) > priorityRank(best.floor) ? rule : best,
  );
  if (priorityRank(model.priority) > priorityRank(strongest.floor)) return fromModel;

  return {
    priority: higherPriority(model.priority, strongest.floor),
    source: `rule:${strongest.name}`,
    reason: strongest.reason,
  };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `pnpm vitest run src/lib/triage/rules.test.ts`
Expected: all tests PASS. If a near-miss or escalation case fails, adjust the regex in `rules.ts` — never the test text.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add src/lib/triage/rules.ts src/lib/triage/rules.test.ts
git commit -q -F - <<'EOF'
Add raise-only safety rules for gas, fire, water and heat

Callers understate danger ("probably nothing"). Deterministic rules
put a floor under the model's priority for hazards that must never be
missed, and record which rule decided.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Prompt and triage pipeline

**Files:**
- Create: `src/lib/triage/prompt.ts`, `src/lib/triage/pipeline.ts`
- Test: `src/lib/triage/pipeline.test.ts`

**Interfaces:**
- Consumes: `groundExtraction` (Task 4), `applySafetyRules` (Task 5), types from Task 2, fixtures.
- Produces (`prompt.ts`): `PROMPT_VERSION = "2026-11-05.1"`, `SYSTEM_PROMPT: string`, `buildUserMessage(text: string, source: Source): string`.
- Produces (`pipeline.ts`): `FALLBACK_SUMMARY: string`, `runTriage(input: TriageInput, extract: Extractor): Promise<TriageResult>`.

- [ ] **Step 1: Write `prompt.ts`**

```ts
import type { Source } from "./schema";

export const PROMPT_VERSION = "2026-11-05.1";

export const SYSTEM_PROMPT = `You triage maintenance reports for a residential property manager. Each report is a tenant's own words, typed or transcribed from a call. Turn it into work orders.

Issue types
- Plumbing: leaks, clogs, toilets, faucets, pipes, water heaters.
- Electrical: outlets, switches, lights, wiring, breakers.
- HVAC: heating, cooling, ventilation, thermostats.
- Appliance: refrigerators, ovens, dishwashers, washers, dryers, when gas is not involved.
- Gas: any smell of gas, gas lines, or a gas appliance that may be leaking.
- Structural: doors, windows, locks, walls, ceilings, floors, stairs, roof.
- Pest: insects, rodents, other animals.
- Other: anything else.

Priority follows hazard and consequence, not the caller's tone. Callers often play down real danger ("probably nothing") or overstate small problems; judge the situation they describe.
- Emergency: risk to people or major property damage right now, such as a gas odor, fire or smoke, sparking, water reaching electrical fixtures, or active flooding.
- High: an essential service is out or damage is spreading, such as no heat in cold weather, no water, or an active leak. Same-day response.
- Medium: something impairs normal use, such as a clogged sink, a broken appliance, or a flickering light. Within a few days.
- Low: minor or cosmetic, with no effect on safety or essential use.

One report can describe several problems. Return one issue per problem that needs its own repair. Keep a single problem together even when it causes a second hazard: a leak dripping onto an outlet is one Plumbing issue at Emergency priority.

Fields
- unit: the apartment or unit exactly as stated, such as "4B". If the report does not state it, return null and include "unit_number" in missing_fields. Never infer a unit.
- area: where in or around the unit, if stated ("bathroom ceiling", "hallway outside the unit"); otherwise null.
- summary: one plain sentence a technician can act on, at most 160 characters.
- priority_rationale: one short sentence explaining the priority in terms of hazard or impact.
- source_quote: the words from the report that describe this problem, copied exactly.
- missing_fields: "unit_number" when no unit is stated; "issue_detail" when the problem is too vague to send anyone.
- caller_stated_urgency: how urgent the caller says it is, separate from your assessment; "none_stated" if they don't say.
- caller_urgency_quote: the caller's exact words about urgency, or null.

In call transcripts, lines starting with "Caller:" are the evidence. Lines starting with "Agent:" are the intake assistant's questions and read-backs; use them only to understand what the caller was answering.`;

const SOURCE_LABEL: Record<Source, string> = {
  text: "Typed report",
  phone: "Phone call transcript",
  web_call: "Browser call transcript",
};

export function buildUserMessage(text: string, source: Source): string {
  const body = text.replace(/<\/?report>/gi, "");
  return `${SOURCE_LABEL[source]}:\n<report>\n${body}\n</report>`;
}
```

- [ ] **Step 2: Write the failing pipeline tests**

`src/lib/triage/pipeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExtraction, makeIssue, sampleText, scriptedExtractor } from "@/test/fixtures";
import { runTriage } from "./pipeline";
import { PROMPT_VERSION } from "./prompt";
import { ExtractionError } from "./types";

const input = (id: string) => ({
  text: sampleText(id),
  source: "text" as const,
  callerLast4: null,
  vapiCallId: null,
});

describe("runTriage", () => {
  it("creates one ticket per issue, in order, for a two-problem report", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction([
        makeIssue(),
        makeIssue({
          issue_type: "Electrical",
          priority: "Low",
          priority_rationale: "Minor, no safety risk reported.",
          summary: "Hallway light outside the unit flickers.",
          area: "hallway outside the unit",
          source_quote: "the hallway light outside my door has been flickering for a week",
        }),
      ]),
    ]);
    const { report, tickets } = await runTriage(input("r3"), extract);
    expect(report.extraction_status).toBe("ok");
    expect(tickets.map((t) => [t.position, t.issue_type, t.unit, t.priority])).toEqual([
      [0, "Plumbing", "12C", "Medium"],
      [1, "Electrical", "12C", "Low"],
    ]);
  });

  it("lets a safety rule overrule a calm model and keeps both views", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction(
        [
          makeIssue({
            issue_type: "Gas",
            priority: "Medium",
            priority_rationale: "Caller is unsure it is serious.",
            unit: "7A",
            area: "kitchen, near the stove",
            summary: "Caller noticed an odd smell near the stove.",
            source_quote: "there's kind of a weird smell near the stove, like maybe gas",
          }),
        ],
        { caller_stated_urgency: "low", caller_urgency_quote: "My neighbor said it's probably nothing" },
      ),
    ]);
    const { report, tickets } = await runTriage(input("r4"), extract);
    expect(tickets[0]).toMatchObject({
      priority: "Emergency",
      model_priority: "Medium",
      priority_source: "rule:gas_odor",
      model_rationale: "Caller is unsure it is serious.",
    });
    expect(report.caller_urgency_quote).toBe("My neighbor said it's probably nothing");
  });

  it("drops an invented unit and flags the ticket for follow-up", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction([
        makeIssue({
          issue_type: "HVAC",
          priority: "High",
          priority_rationale: "No heat in freezing weather.",
          unit: "3A",
          area: null,
          summary: "Heat is not working.",
          source_quote: "the heat isn't working in my place",
        }),
      ]),
    ]);
    const { tickets } = await runTriage(input("r2"), extract);
    expect(tickets[0]).toMatchObject({
      unit: null,
      needs_followup: true,
      missing_fields: ["unit_number"],
      grounding_notes: ["unit_not_in_report"],
    });
  });

  it("checks rules against the whole report when the quote is not grounded", async () => {
    const { extract } = scriptedExtractor([
      makeExtraction([
        makeIssue({
          unit: "4B",
          priority: "High",
          priority_rationale: "Active leak.",
          area: "bathroom ceiling",
          summary: "Bathroom ceiling leak.",
          source_quote: "water is coming through the ceiling",
        }),
      ]),
    ]);
    const { tickets } = await runTriage(input("r1"), extract);
    expect(tickets[0]).toMatchObject({
      source_quote: null,
      priority: "Emergency",
      priority_source: "rule:water_electrical",
    });
  });

  it("retries once after an extraction failure", async () => {
    const { extract, callCount } = scriptedExtractor([
      new ExtractionError("timeout", "api"),
      makeExtraction([makeIssue()]),
    ]);
    const { report } = await runTriage(input("r3"), extract);
    expect(report.extraction_status).toBe("ok");
    expect(callCount()).toBe(2);
  });

  it("saves a manual-review ticket when extraction fails twice", async () => {
    const { extract, callCount } = scriptedExtractor([
      new ExtractionError("Model declined the request", "refusal"),
    ]);
    const { report, tickets } = await runTriage(input("r5"), extract);
    expect(callCount()).toBe(2);
    expect(report).toMatchObject({
      extraction_status: "fallback",
      error: "Model declined the request",
      raw_text: sampleText("r5"),
    });
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      issue_type: "Other",
      priority: "High",
      priority_source: "fallback",
      needs_followup: true,
    });
  });

  it("does not hide programming errors behind the fallback", async () => {
    const { extract } = scriptedExtractor([new TypeError("boom")]);
    await expect(runTriage(input("r5"), extract)).rejects.toThrow(TypeError);
  });

  it("records the audit trail on the report", async () => {
    const extraction = makeExtraction([makeIssue()]);
    const { extract } = scriptedExtractor([extraction]);
    const { report } = await runTriage(input("r3"), extract);
    expect(report).toMatchObject({
      model: "claude-fable-5-1",
      latency_ms: 1234,
      prompt_version: PROMPT_VERSION,
      llm_output: extraction,
      source: "text",
    });
  });
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `pnpm vitest run src/lib/triage/pipeline.test.ts`
Expected: FAIL — cannot resolve `./pipeline`.

- [ ] **Step 4: Implement `pipeline.ts`**

```ts
import { groundExtraction } from "./ground";
import { PROMPT_VERSION } from "./prompt";
import { applySafetyRules } from "./rules";
import {
  ExtractionError,
  type Extractor,
  type ExtractorResult,
  type ReportDraft,
  type TicketDraft,
  type TriageInput,
  type TriageResult,
} from "./types";

const MAX_ATTEMPTS = 2;

export const FALLBACK_SUMMARY = "Needs manual review: automatic extraction failed.";

type ReportBase = Pick<
  ReportDraft,
  "source" | "raw_text" | "caller_last4" | "vapi_call_id" | "prompt_version"
>;

function reportBase(input: TriageInput): ReportBase {
  return {
    source: input.source,
    raw_text: input.text,
    caller_last4: input.callerLast4,
    vapi_call_id: input.vapiCallId,
    prompt_version: PROMPT_VERSION,
  };
}

function buildResult(input: TriageInput, extracted: ExtractorResult): TriageResult {
  const grounded = groundExtraction(extracted.output, input.text);
  const tickets = grounded.issues.map((issue, position): TicketDraft => {
    const evidence = issue.source_quote ?? input.text;
    const outcome = applySafetyRules(
      { priority: issue.priority, rationale: issue.priority_rationale },
      `${evidence} ${issue.summary}`,
    );
    return {
      position,
      issue_type: issue.issue_type,
      priority: outcome.priority,
      model_priority: issue.priority,
      priority_source: outcome.source,
      priority_reason: outcome.reason,
      model_rationale: issue.priority_rationale,
      unit: issue.unit,
      area: issue.area,
      summary: issue.summary,
      source_quote: issue.source_quote,
      missing_fields: issue.missing_fields,
      grounding_notes: issue.grounding_notes,
      needs_followup: issue.missing_fields.length > 0,
    };
  });

  return {
    report: {
      ...reportBase(input),
      caller_stated_urgency: grounded.caller_stated_urgency,
      caller_urgency_quote: grounded.caller_urgency_quote,
      extraction_status: "ok",
      model: extracted.model,
      llm_output: extracted.output,
      latency_ms: extracted.latencyMs,
      error: null,
    },
    tickets,
  };
}

function buildFallback(input: TriageInput, error: ExtractionError | null): TriageResult {
  return {
    report: {
      ...reportBase(input),
      caller_stated_urgency: null,
      caller_urgency_quote: null,
      extraction_status: "fallback",
      model: null,
      llm_output: null,
      latency_ms: null,
      error: error?.message ?? "Extraction failed",
    },
    tickets: [
      {
        position: 0,
        issue_type: "Other",
        priority: "High",
        model_priority: null,
        priority_source: "fallback",
        priority_reason: "Automatic extraction failed, so a person needs to read the original report.",
        model_rationale: null,
        unit: null,
        area: null,
        summary: FALLBACK_SUMMARY,
        source_quote: null,
        missing_fields: ["unit_number", "issue_detail"],
        grounding_notes: [],
        needs_followup: true,
      },
    ],
  };
}

export async function runTriage(input: TriageInput, extract: Extractor): Promise<TriageResult> {
  let lastError: ExtractionError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return buildResult(input, await extract({ text: input.text, source: input.source }));
    } catch (error) {
      if (!(error instanceof ExtractionError)) throw error;
      lastError = error;
    }
  }
  return buildFallback(input, lastError);
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `pnpm vitest run src/lib/triage/pipeline.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add src/lib/triage/prompt.ts src/lib/triage/pipeline.ts src/lib/triage/pipeline.test.ts
git commit -q -F - <<'EOF'
Assemble the triage pipeline with one retry and a safe fallback

If extraction fails twice the report is still saved with a
manual-review ticket, so a caller's report is never silently lost.
Programming errors are rethrown rather than disguised as fallbacks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Anthropic extractor (Claude Fable 5.1)

**Files:**
- Create: `src/lib/triage/extract.ts`
- Test: `src/lib/triage/extract.test.ts`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT`, `buildUserMessage` (Task 6); `EXTRACTION_JSON_SCHEMA`, `extractionSchema` (Task 2); `ExtractionError`, `Extractor` (Task 2).
- Produces: `DEFAULT_MODEL = "claude-fable-5-1"`, `createExtractor(client: Anthropic, model?: string): Extractor`.

Load the `claude-api` skill before writing this file. Verified against `@anthropic-ai/sdk` 1.5.0 types: `client.beta.messages.create` accepts `betas`, `fallbacks: "default"` (`BetaFallbacksParam = Array<…> | 'default'`), and `output_config: { effort, format: { type: "json_schema", schema } }`; `stop_reason` includes `"refusal"`; the client constructor accepts a custom `fetch`.

- [ ] **Step 1: Write the failing tests**

`src/lib/triage/extract.test.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { makeExtraction, makeIssue } from "@/test/fixtures";
import { createExtractor } from "./extract";
import { SYSTEM_PROMPT } from "./prompt";
import { ExtractionError } from "./types";

interface Captured {
  headers: Headers;
  body: Record<string, unknown>;
}

function message(text: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-fable-5-1",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 },
    ...overrides,
  };
}

function fakeClient(responseBody: unknown, status = 200, captured: Captured[] = []) {
  return new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: async (_input, init) => {
      captured.push({
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify(responseBody), {
        status,
        headers: { "content-type": "application/json" },
      });
    },
  });
}

const extraction = makeExtraction([makeIssue()]);
const call = { text: "Unit 12C here. The kitchen sink is clogged.", source: "text" as const };

describe("createExtractor", () => {
  it("sends a structured-output request with server-side fallback", async () => {
    const captured: Captured[] = [];
    await createExtractor(fakeClient(message(JSON.stringify(extraction)), 200, captured))(call);
    const [request] = captured;
    expect(request?.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(request?.body).toMatchObject({
      model: "claude-fable-5-1",
      system: SYSTEM_PROMPT,
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    expect(request?.body).not.toHaveProperty("thinking");
  });

  it("leaves fallbacks off for models that do not support them", async () => {
    const captured: Captured[] = [];
    await createExtractor(
      fakeClient(message(JSON.stringify(extraction)), 200, captured),
      "claude-haiku-5-5",
    )(call);
    expect(captured[0]?.body).not.toHaveProperty("fallbacks");
    expect(captured[0]?.headers.get("anthropic-beta")).toBeNull();
  });

  it("returns the validated output with model and latency", async () => {
    const result = await createExtractor(fakeClient(message(JSON.stringify(extraction))))(call);
    expect(result.output).toEqual(extraction);
    expect(result.model).toBe("claude-fable-5-1");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ["refusal", message("", { stop_reason: "refusal" })],
    ["truncated", message("{", { stop_reason: "max_tokens" })],
    ["invalid_output", message("not json")],
    ["invalid_output", message(JSON.stringify({ issues: [] }))],
  ])("raises ExtractionError(%s)", async (kind, body) => {
    await expect(createExtractor(fakeClient(body))(call)).rejects.toMatchObject({
      name: "ExtractionError",
      kind,
    });
  });

  it("wraps API errors so the pipeline can retry", async () => {
    const error = { type: "error", error: { type: "api_error", message: "overloaded" } };
    const attempt = createExtractor(fakeClient(error, 529))(call);
    await expect(attempt).rejects.toBeInstanceOf(ExtractionError);
    await expect(attempt).rejects.toMatchObject({ kind: "api" });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/lib/triage/extract.test.ts`
Expected: FAIL — cannot resolve `./extract`.

- [ ] **Step 3: Implement `extract.ts`**

```ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { EXTRACTION_JSON_SCHEMA, extractionSchema } from "./schema";
import { ExtractionError, type Extractor } from "./types";

export const DEFAULT_MODEL = "claude-fable-5-1";

const MODELS_WITH_SERVER_FALLBACK = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);

function toExtractionError(error: unknown): unknown {
  if (error instanceof Anthropic.APIError) {
    return new ExtractionError(`Anthropic API error (${error.status ?? "network"}): ${error.message}`, "api");
  }
  return error;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function createExtractor(client: Anthropic, model: string = DEFAULT_MODEL): Extractor {
  const fallback = MODELS_WITH_SERVER_FALLBACK.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  return async ({ text, source }) => {
    const started = performance.now();
    const response = await client.beta.messages
      .create(
        {
          model,
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          output_config: {
            effort: "low",
            format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA },
          },
          messages: [{ role: "user", content: buildUserMessage(text, source) }],
          ...fallback,
        },
        { timeout: 45_000 },
      )
      .catch((error: unknown) => {
        throw toExtractionError(error);
      });
    const latencyMs = Math.round(performance.now() - started);

    if (response.stop_reason === "refusal") {
      throw new ExtractionError("Model declined the request", "refusal");
    }
    if (response.stop_reason === "max_tokens") {
      throw new ExtractionError("Model output was cut off", "truncated");
    }

    const reply = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    const parsed = extractionSchema.safeParse(parseJson(reply));
    if (!parsed.success) {
      throw new ExtractionError(`Model output failed validation: ${parsed.error.message}`, "invalid_output");
    }
    return { output: parsed.data, model: response.model, latencyMs };
  };
}
```

If the compiler rejects the spread of `fallback` into the params, build the params object in two branches (`MODELS_WITH_SERVER_FALLBACK.has(model) ? {...base, betas, fallbacks} : base`) instead — do not cast.

- [ ] **Step 4: Run and watch it pass**

Run: `pnpm vitest run src/lib/triage/extract.test.ts && pnpm typecheck`
Expected: 8 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add src/lib/triage/extract.ts src/lib/triage/extract.test.ts
git commit -q -F - <<'EOF'
Call Claude Fable 5.1 with structured output and refusal fallback

Low effort is enough for short reports. Server-side fallback reroutes
a policy refusal instead of failing the ticket; models without it get
a plain request. Tests check the request on the wire via a fake fetch.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Evaluate the five sample reports against the real model

**Files:**
- Create: `src/lib/triage/eval-check.ts`, `scripts/eval.ts`, `src/lib/env.ts`, `docs/walkthrough.md`

**Interfaces:**
- Consumes: `SAMPLE_REPORTS`, `runTriage`, `createExtractor`, `DEFAULT_MODEL`, `PROMPT_VERSION`.
- Produces (`eval-check.ts`): `interface SampleOutcome { sample: SampleReport; result: TriageResult; failures: string[] }`, `checkSample(sample, result): string[]`, `renderResultsTable(outcomes: SampleOutcome[]): string`.
- Produces (`env.ts`): `requireEnv(name: string): string`.

- [ ] **Step 1: Write `src/lib/env.ts`**

```ts
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}
```

- [ ] **Step 2: Write `src/lib/triage/eval-check.ts`**

```ts
import type { SampleReport } from "./samples";
import type { TriageResult } from "./types";

export interface SampleOutcome {
  sample: SampleReport;
  result: TriageResult;
  failures: string[];
}

export function checkSample(sample: SampleReport, result: TriageResult): string[] {
  const failures: string[] = [];
  if (result.report.extraction_status !== "ok") {
    failures.push(`extraction fell back (${result.report.error ?? "unknown error"})`);
  }
  if (result.tickets.length !== sample.expected.length) {
    failures.push(`expected ${sample.expected.length} ticket(s), got ${result.tickets.length}`);
  }

  const unmatched = [...result.tickets];
  for (const want of sample.expected) {
    const index = unmatched.findIndex((ticket) => ticket.issue_type === want.issue_type);
    const got = index === -1 ? undefined : unmatched.splice(index, 1)[0];
    if (!got) {
      failures.push(`no ${want.issue_type} ticket`);
      continue;
    }
    if (!want.priorities.includes(got.priority)) {
      failures.push(`${want.issue_type} priority ${got.priority}, expected ${want.priorities.join(" or ")}`);
    }
    if (got.unit !== want.unit) {
      failures.push(`${want.issue_type} unit ${got.unit ?? "null"}, expected ${want.unit ?? "null"}`);
    }
    if (got.needs_followup !== want.needs_followup) {
      failures.push(`${want.issue_type} needs_followup ${String(got.needs_followup)}`);
    }
    if (want.priority_source && got.priority_source !== want.priority_source) {
      failures.push(`${want.issue_type} priority source ${got.priority_source}, expected ${want.priority_source}`);
    }
  }
  return failures;
}

export function renderResultsTable(outcomes: SampleOutcome[]): string {
  const header = [
    "| # | Report | Tickets | Type → priority (decided by) | Unit | Follow-up | Latency | Result |",
    "|---|---|---|---|---|---|---|---|",
  ];
  const rows = outcomes.map(({ sample, result, failures }, index) => {
    const join = (values: string[]) => values.join("<br>");
    const types = join(result.tickets.map((t) => `${t.issue_type} → **${t.priority}** (${t.priority_source})`));
    const units = join(result.tickets.map((t) => t.unit ?? "—"));
    const followUps = join(
      result.tickets.map((t) => (t.needs_followup ? `yes: ${t.missing_fields.join(", ")}` : "no")),
    );
    const latency =
      result.report.latency_ms === null ? "—" : `${(result.report.latency_ms / 1000).toFixed(1)} s`;
    const verdict = failures.length === 0 ? "pass" : `FAIL: ${failures.join("; ")}`;
    return `| ${index + 1} | ${sample.label} | ${result.tickets.length} | ${types} | ${units} | ${followUps} | ${latency} | ${verdict} |`;
  });
  return [...header, ...rows].join("\n");
}
```

- [ ] **Step 3: Write `docs/walkthrough.md`**

```markdown
# Walkthrough

## Results on the five sample reports

Generated by `pnpm eval`, which runs each report from the brief through the real pipeline and model.

<!-- eval:start -->
<!-- eval:end -->
```

- [ ] **Step 4: Write `scripts/eval.ts`**

```ts
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { requireEnv } from "@/lib/env";
import { checkSample, renderResultsTable, type SampleOutcome } from "@/lib/triage/eval-check";
import { createExtractor, DEFAULT_MODEL } from "@/lib/triage/extract";
import { runTriage } from "@/lib/triage/pipeline";
import { PROMPT_VERSION } from "@/lib/triage/prompt";
import { SAMPLE_REPORTS } from "@/lib/triage/samples";

const WALKTHROUGH = fileURLToPath(new URL("../docs/walkthrough.md", import.meta.url));
const START = "<!-- eval:start -->";
const END = "<!-- eval:end -->";

async function writeResults(content: string): Promise<void> {
  const doc = await readFile(WALKTHROUGH, "utf8");
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  if (start === -1 || end === -1) throw new Error(`docs/walkthrough.md needs ${START} and ${END}`);
  await writeFile(WALKTHROUGH, `${doc.slice(0, start + START.length)}\n${content}\n${doc.slice(end)}`);
}

async function main(): Promise<void> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const extract = createExtractor(new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") }), model);

  const outcomes: SampleOutcome[] = [];
  for (const sample of SAMPLE_REPORTS) {
    const result = await runTriage(
      { text: sample.text, source: "text", callerLast4: null, vapiCallId: null },
      extract,
    );
    const failures = checkSample(sample, result);
    outcomes.push({ sample, result, failures });
    console.log(`${failures.length === 0 ? "PASS" : "FAIL"}  ${sample.label}  ${failures.join("; ")}`);
  }

  const ranAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  await writeResults(
    `Model \`${model}\`, prompt \`${PROMPT_VERSION}\`, run ${ranAt} UTC.\n\n${renderResultsTable(outcomes)}`,
  );

  const failed = outcomes.filter((outcome) => outcome.failures.length > 0).length;
  console.log(failed === 0 ? "\nAll five sample reports pass." : `\n${failed} sample report(s) failed.`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run the eval against Claude Fable 5.1**

Run: `pnpm eval`
Expected: five `PASS` lines, "All five sample reports pass.", and the table written into `docs/walkthrough.md`. Each report makes one real API call (cents in total). Note the latency column.

If a report fails:
1. Read the failure and the model's raw output (temporarily log `result.report.llm_output` — remove before committing).
2. If the model is wrong, refine `SYSTEM_PROMPT` with a definition, not a special case for that report, and bump `PROMPT_VERSION` (`2026-11-05.2`, …). Rerun.
3. Never loosen `samples.ts` expectations or the rules to make a run pass.
4. After three prompt revisions without five passes, stop and report the failing case, the raw output and the revisions tried.

- [ ] **Step 6: Typecheck, lint, test, commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm format
git add src/lib/env.ts src/lib/triage/eval-check.ts scripts/eval.ts docs/walkthrough.md src/lib/triage/prompt.ts
git commit -q -F - <<'EOF'
Add a live eval over the brief's five sample reports

Runs each report through the real model and pipeline, checks ticket
count, type, priority, unit and follow-up flag, and writes the results
table into the walkthrough. Not part of CI because it costs money.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

If the prompt changed during Step 5, mention the revisions and why in the commit body.

---

### Task 9: Database schema and migration runner

**Files:**
- Create: `supabase/migrations/20261105000000_init.sql`, `scripts/db-migrate.ts`

**Interfaces:**
- Produces (database): tables `public.reports`, `public.work_orders`, `public.intake_events`; functions `public.create_report_with_work_orders(p_report jsonb, p_orders jsonb) returns uuid` (returns null when `vapi_call_id` already exists) and `public.check_intake_rate(p_ip_hash text, p_max_per_minute integer) returns boolean`; `work_orders` in the `supabase_realtime` publication.

Load the `supabase` and `supabase-postgres-best-practices` skills before writing the SQL. The Supabase CLI is not used: its binary download is blocked by pnpm's build-script policy and the workspace path is non-ASCII. The runner records versions in `supabase_migrations.schema_migrations`, the same table the CLI uses, so the CLI can take over later.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20261105000000_init.sql`:

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('text', 'phone', 'web_call')),
  raw_text text not null check (char_length(raw_text) between 1 and 8000),
  caller_last4 text check (caller_last4 ~ '^[0-9]{4}$'),
  vapi_call_id text unique,
  caller_stated_urgency text check (
    caller_stated_urgency in ('none_stated', 'low', 'medium', 'high', 'emergency')
  ),
  caller_urgency_quote text check (char_length(caller_urgency_quote) <= 300),
  extraction_status text not null check (extraction_status in ('ok', 'fallback')),
  model text,
  prompt_version text not null,
  llm_output jsonb,
  latency_ms integer check (latency_ms >= 0),
  error text
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  issue_type text not null check (
    issue_type in ('Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Gas', 'Structural', 'Pest', 'Other')
  ),
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Emergency')),
  model_priority text check (model_priority in ('Low', 'Medium', 'High', 'Emergency')),
  priority_source text not null check (
    priority_source in ('model', 'fallback') or priority_source like 'rule:%'
  ),
  priority_reason text not null check (char_length(priority_reason) <= 300),
  model_rationale text check (char_length(model_rationale) <= 300),
  unit text check (char_length(unit) <= 20),
  area text check (char_length(area) <= 80),
  summary text not null check (char_length(summary) between 1 and 200),
  source_quote text check (char_length(source_quote) <= 600),
  missing_fields text[] not null default '{}'
    check (missing_fields <@ array['unit_number', 'issue_detail']::text[]),
  grounding_notes text[] not null default '{}',
  needs_followup boolean not null default false,
  status text not null default 'New' check (status in ('New', 'In Progress', 'Done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, position)
);

create index work_orders_board_idx on public.work_orders (status, priority, created_at desc);

create table public.intake_events (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index intake_events_ip_time_idx on public.intake_events (ip_hash, created_at desc);
create index intake_events_time_idx on public.intake_events (created_at);

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger work_orders_touch_updated_at
before update on public.work_orders
for each row execute function public.touch_updated_at();

create function public.create_report_with_work_orders(p_report jsonb, p_orders jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  insert into public.reports (
    source, raw_text, caller_last4, vapi_call_id, caller_stated_urgency, caller_urgency_quote,
    extraction_status, model, prompt_version, llm_output, latency_ms, error
  )
  values (
    p_report ->> 'source',
    p_report ->> 'raw_text',
    p_report ->> 'caller_last4',
    p_report ->> 'vapi_call_id',
    p_report ->> 'caller_stated_urgency',
    p_report ->> 'caller_urgency_quote',
    p_report ->> 'extraction_status',
    p_report ->> 'model',
    p_report ->> 'prompt_version',
    nullif(p_report -> 'llm_output', 'null'::jsonb),
    (p_report ->> 'latency_ms')::integer,
    p_report ->> 'error'
  )
  on conflict (vapi_call_id) do nothing
  returning id into v_report_id;

  if v_report_id is null then
    return null;
  end if;

  insert into public.work_orders (
    report_id, position, issue_type, priority, model_priority, priority_source, priority_reason,
    model_rationale, unit, area, summary, source_quote, missing_fields, grounding_notes,
    needs_followup
  )
  select
    v_report_id,
    (o ->> 'position')::smallint,
    o ->> 'issue_type',
    o ->> 'priority',
    o ->> 'model_priority',
    o ->> 'priority_source',
    o ->> 'priority_reason',
    o ->> 'model_rationale',
    o ->> 'unit',
    o ->> 'area',
    o ->> 'summary',
    o ->> 'source_quote',
    array(select jsonb_array_elements_text(o -> 'missing_fields')),
    array(select jsonb_array_elements_text(o -> 'grounding_notes')),
    (o ->> 'needs_followup')::boolean
  from jsonb_array_elements(p_orders) as o;

  return v_report_id;
end;
$$;

create function public.check_intake_rate(p_ip_hash text, p_max_per_minute integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  delete from public.intake_events where created_at < now() - interval '1 hour';
  select count(*) into v_recent
    from public.intake_events
    where ip_hash = p_ip_hash and created_at > now() - interval '1 minute';
  if v_recent >= p_max_per_minute then
    return false;
  end if;
  insert into public.intake_events (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

alter table public.reports enable row level security;
alter table public.work_orders enable row level security;
alter table public.intake_events enable row level security;

revoke all on public.reports, public.work_orders, public.intake_events from anon, authenticated;
grant select on public.reports, public.work_orders to anon, authenticated;
grant select, insert, update, delete
  on public.reports, public.work_orders, public.intake_events to service_role;

create policy "Dashboard reads reports" on public.reports
  for select to anon, authenticated using (true);
create policy "Dashboard reads work orders" on public.work_orders
  for select to anon, authenticated using (true);

revoke execute on function public.create_report_with_work_orders(jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.check_intake_rate(text, integer)
  from public, anon, authenticated;
grant execute on function public.create_report_with_work_orders(jsonb, jsonb) to service_role;
grant execute on function public.check_intake_rate(text, integer) to service_role;

alter publication supabase_realtime add table public.work_orders;
```

- [ ] **Step 2: Write `scripts/db-migrate.ts`**

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.example).");

  // Supabase's pooler presents a certificate from its own CA, which Node does not ship.
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key, statements text[], name text
      );
    `);
    const applied = new Set(
      (await client.query<{ version: string }>("select version from supabase_migrations.schema_migrations")).rows.map(
        (row) => row.version,
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const [version, ...nameParts] = file.replace(/\.sql$/, "").split("_");
      if (!version || applied.has(version)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)",
          [version, nameParts.join("_")],
        );
        await client.query("commit");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    console.log("database is up to date");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Apply the migration**

Run: `pnpm db:migrate`
Expected: `applied 20261105000000_init.sql` then `database is up to date`. Run it again: only `database is up to date`.

- [ ] **Step 4: Verify the access model from outside**

```bash
set -a; . ./.env.local; set +a
URL="$NEXT_PUBLIC_SUPABASE_URL"; PUB="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"; SEC="$SUPABASE_SECRET_KEY"
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "browser reads work_orders:      $(code "$URL/rest/v1/work_orders?select=id&limit=1" -H "apikey: $PUB")   # 200"
echo "browser insert blocked:         $(code -X POST "$URL/rest/v1/work_orders" -H "apikey: $PUB" -H 'Content-Type: application/json' -d '{}')   # 401 or 403"
echo "browser cannot see intake log:  $(code "$URL/rest/v1/intake_events?select=id" -H "apikey: $PUB")   # 401, 403 or 404"
echo "browser cannot call save fn:    $(code -X POST "$URL/rest/v1/rpc/create_report_with_work_orders" -H "apikey: $PUB" -H 'Content-Type: application/json' -d '{"p_report":{},"p_orders":[]}')   # 401, 403 or 404"
echo "server rate check:              $(curl -s -X POST "$URL/rest/v1/rpc/check_intake_rate" -H "apikey: $SEC" -H 'Content-Type: application/json' -d '{"p_ip_hash":"migration-check","p_max_per_minute":10}')   # true"
```

Then prove duplicate call ids are ignored, and clean up:

```bash
BODY='{"p_report":{"source":"phone","raw_text":"Caller: test","vapi_call_id":"migration-dup-check","extraction_status":"fallback","prompt_version":"check"},"p_orders":[]}'
curl -s -X POST "$URL/rest/v1/rpc/create_report_with_work_orders" -H "apikey: $SEC" -H 'Content-Type: application/json' -d "$BODY"; echo "   # a uuid"
curl -s -X POST "$URL/rest/v1/rpc/create_report_with_work_orders" -H "apikey: $SEC" -H 'Content-Type: application/json' -d "$BODY"; echo "   # null"
curl -s -o /dev/null -w "cleanup: %{http_code}\n" -X DELETE "$URL/rest/v1/reports?vapi_call_id=eq.migration-dup-check" -H "apikey: $SEC"
curl -s -o /dev/null -w "cleanup: %{http_code}\n" -X DELETE "$URL/rest/v1/intake_events?ip_hash=eq.migration-check" -H "apikey: $SEC"
```

Expected: every line matches its comment. If the browser *can* insert or read `intake_events`, stop: the grants are wrong.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261105000000_init.sql scripts/db-migrate.ts
git commit -q -F - <<'EOF'
Add Supabase schema with read-only browser access

The browser key may only select reports and work orders; every write
goes through two server-only functions. Grants are explicit because
Supabase no longer exposes new tables to the Data API by default.
Duplicate Vapi call ids are ignored, so webhook retries are harmless.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Persistence layer

**Files:**
- Create: `src/lib/db/types.ts`, `src/lib/db/store.ts`, `src/lib/db/server-store.ts`
- Modify: `scripts/eval.ts`

**Interfaces:**
- Consumes: `TicketDraft`, `ReportDraft`, `TriageResult`, `Status`; database functions from Task 9.
- Produces (`types.ts`): `interface ReportRow extends ReportDraft { id: string; created_at: string }`, `interface WorkOrderRow extends TicketDraft { id: string; report_id: string; status: Status; created_at: string; updated_at: string }`.
- Produces (`store.ts`): `interface SavedTriage { report: ReportRow; workOrders: WorkOrderRow[] }`, `interface TriageStore { saveTriage(result: TriageResult): Promise<SavedTriage | null>; allowIntake(ipHash: string, maxPerMinute: number): Promise<boolean>; updateStatus(id: string, status: Status): Promise<WorkOrderRow | null> }`, `class StoreError`.
- Produces (`server-store.ts`): `createServerStore(url: string, secretKey: string): TriageStore`.

- [ ] **Step 1: Write `types.ts` and `store.ts`**

`src/lib/db/types.ts`:

```ts
import type { Status } from "@/lib/triage/schema";
import type { ReportDraft, TicketDraft } from "@/lib/triage/types";

export interface ReportRow extends ReportDraft {
  id: string;
  created_at: string;
}

export interface WorkOrderRow extends TicketDraft {
  id: string;
  report_id: string;
  status: Status;
  created_at: string;
  updated_at: string;
}
```

`src/lib/db/store.ts`:

```ts
import type { Status } from "@/lib/triage/schema";
import type { TriageResult } from "@/lib/triage/types";
import type { ReportRow, WorkOrderRow } from "./types";

export interface SavedTriage {
  report: ReportRow;
  workOrders: WorkOrderRow[];
}

export interface TriageStore {
  saveTriage(result: TriageResult): Promise<SavedTriage | null>;
  allowIntake(ipHash: string, maxPerMinute: number): Promise<boolean>;
  updateStatus(id: string, status: Status): Promise<WorkOrderRow | null>;
}

export class StoreError extends Error {
  constructor(operation: string, cause: { message: string }) {
    super(`Database ${operation} failed: ${cause.message}`);
    this.name = "StoreError";
  }
}
```

- [ ] **Step 2: Write `server-store.ts`**

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Status } from "@/lib/triage/schema";
import type { TriageResult } from "@/lib/triage/types";
import { StoreError, type SavedTriage, type TriageStore } from "./store";
import type { ReportRow, WorkOrderRow } from "./types";

export function createServerStore(url: string, secretKey: string): TriageStore {
  const db = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async saveTriage({ report, tickets }: TriageResult): Promise<SavedTriage | null> {
      const saved = await db.rpc("create_report_with_work_orders", {
        p_report: report,
        p_orders: tickets,
      });
      if (saved.error) throw new StoreError("save triage", saved.error);
      if (typeof saved.data !== "string") return null;

      const [reportResult, ordersResult] = await Promise.all([
        db.from("reports").select("*").eq("id", saved.data).single(),
        db.from("work_orders").select("*").eq("report_id", saved.data).order("position"),
      ]);
      if (reportResult.error) throw new StoreError("read report", reportResult.error);
      if (ordersResult.error) throw new StoreError("read work orders", ordersResult.error);
      const reportRow: ReportRow = reportResult.data;
      const workOrders: WorkOrderRow[] = ordersResult.data;
      return { report: reportRow, workOrders };
    },

    async allowIntake(ipHash: string, maxPerMinute: number): Promise<boolean> {
      const { data, error } = await db.rpc("check_intake_rate", {
        p_ip_hash: ipHash,
        p_max_per_minute: maxPerMinute,
      });
      if (error) throw new StoreError("check rate limit", error);
      return data === true;
    },

    async updateStatus(id: string, status: Status): Promise<WorkOrderRow | null> {
      const { data, error } = await db
        .from("work_orders")
        .update({ status })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new StoreError("update status", error);
      const row: WorkOrderRow | null = data;
      return row;
    },
  };
}
```

The client is untyped (no generated database types), so query results are assignable to the row interfaces. If a later supabase-js version types them as `unknown`, parse with a Zod schema instead of casting.

- [ ] **Step 3: Add `--persist` to the eval**

In `scripts/eval.ts`, add the import:

```ts
import { createServerStore } from "@/lib/db/server-store";
```

At the top of `main()`, after `extract` is created:

```ts
  const store = process.argv.includes("--persist")
    ? createServerStore(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"))
    : null;
```

Inside the loop, after `outcomes.push(...)`:

```ts
    if (store) await store.saveTriage(result);
```

- [ ] **Step 4: Verify against the live database**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm eval --persist
set -a; . ./.env.local; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/work_orders?select=issue_type,priority,unit,needs_followup,priority_source&order=created_at" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Expected: five PASS lines; the curl (with the *publishable* key) returns six work orders matching the walkthrough table.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add src/lib/db/ scripts/eval.ts docs/walkthrough.md
git commit -q -F - <<'EOF'
Persist triage results through a Supabase-backed store

Routes depend on the TriageStore interface, so handler tests use a
fake and only this module talks to Supabase. `pnpm eval --persist`
seeds the dashboard with the five sample reports.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 11: API routes

**Files:**
- Create: `src/lib/api/http.ts`, `src/lib/api/client-ip.ts`, `src/lib/api/create-report.ts`, `src/lib/api/update-status.ts`, `src/lib/api/deps.ts`, `src/app/api/reports/route.ts`, `src/app/api/work-orders/[id]/route.ts`
- Test: `src/lib/api/create-report.test.ts`, `src/lib/api/update-status.test.ts`, `src/lib/api/http.test.ts`

**Interfaces:**
- Consumes: `TriageStore`, `SavedTriage`, `WorkOrderRow`, `ReportRow` (Task 10); `runTriage` (Task 6); `normalizeReportText`, `MAX_REPORT_CHARS` (Task 3); `createExtractor`, `DEFAULT_MODEL` (Task 7); `requireEnv` (Task 8); `STATUSES` (Task 2).
- Produces (`http.ts`): `type ErrorCode = "invalid_input" | "rate_limited" | "not_found" | "unauthorized" | "internal"`, `errorResponse(code, message, headers?): Response`, `readJson(req: Request): Promise<unknown>`, `withErrorBoundary(handler)`.
- Produces (`client-ip.ts`): `clientIp(headers: Headers): string`, `hashIp(ip: string, salt: string): string`.
- Produces (`create-report.ts`): `interface CreateReportDeps { store: TriageStore; extract: Extractor; hashIp: (ip: string) => string; maxPerMinute: number }`, `handleCreateReport(req: Request, deps: CreateReportDeps): Promise<Response>`.
- Produces (`update-status.ts`): `handleUpdateStatus(req: Request, id: string, store: Pick<TriageStore, "updateStatus">): Promise<Response>`.
- Produces (`deps.ts`): `getDeps(): CreateReportDeps` (memoized; reads env on first use).

- [ ] **Step 1: Write the failing tests**

`src/lib/api/http.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { withErrorBoundary } from "./http";

describe("withErrorBoundary", () => {
  it("turns an unexpected throw into a JSON 500 without leaking the message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorBoundary(async () => {
      throw new Error("connection string postgres://secret");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("postgres");
  });
});
```

`src/lib/api/create-report.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { SavedTriage, TriageStore } from "@/lib/db/store";
import { makeExtraction, makeIssue, sampleText, scriptedExtractor } from "@/test/fixtures";
import { ExtractionError, type TriageResult } from "@/lib/triage/types";
import { handleCreateReport, type CreateReportDeps } from "./create-report";

function toSaved({ report, tickets }: TriageResult): SavedTriage {
  const now = new Date().toISOString();
  return {
    report: { ...report, id: "report-1", created_at: now },
    workOrders: tickets.map((ticket, index) => ({
      ...ticket,
      id: `order-${index}`,
      report_id: "report-1",
      status: "New",
      created_at: now,
      updated_at: now,
    })),
  };
}

function setup(options: { allow?: boolean; steps?: Parameters<typeof scriptedExtractor>[0] } = {}) {
  const saved: TriageResult[] = [];
  const store: TriageStore = {
    saveTriage: vi.fn(async (result: TriageResult) => {
      saved.push(result);
      return toSaved(result);
    }),
    allowIntake: vi.fn(async () => options.allow ?? true),
    updateStatus: vi.fn(async () => null),
  };
  const extractor = scriptedExtractor(
    options.steps ?? [
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
    ],
  );
  const deps: CreateReportDeps = {
    store,
    extract: extractor.extract,
    hashIp: (ip) => `hash:${ip}`,
    maxPerMinute: 10,
  };
  return { deps, store, saved, extractor };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/reports", () => {
  it("triages, saves and returns the work orders", async () => {
    const { deps, saved } = setup();
    const response = await handleCreateReport(post({ text: sampleText("r5") }), deps);
    expect(response.status).toBe(201);
    const body = (await response.json()) as { work_orders: Array<{ issue_type: string; unit: string }> };
    expect(body.work_orders).toEqual([expect.objectContaining({ issue_type: "Structural", unit: "2D" })]);
    expect(saved[0]?.report.source).toBe("text");
  });

  it.each([
    ["missing text", {}],
    ["non-JSON body", "text=hello"],
    ["blank text", { text: "  \n\t " }],
    ["text over the limit", { text: "a".repeat(2001) }],
  ])("rejects %s with 400", async (_label, body) => {
    const { deps, extractor } = setup();
    const response = await handleCreateReport(post(body), deps);
    expect(response.status).toBe(400);
    expect(extractor.callCount()).toBe(0);
  });

  it("rate limits by hashed client IP before calling the model", async () => {
    const { deps, store, extractor } = setup({ allow: false });
    const response = await handleCreateReport(
      post({ text: sampleText("r5") }, { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
      deps,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(store.allowIntake).toHaveBeenCalledWith("hash:203.0.113.7", 10);
    expect(extractor.callCount()).toBe(0);
  });

  it("still saves a manual-review ticket when the model keeps failing", async () => {
    const { deps } = setup({ steps: [new ExtractionError("overloaded", "api")] });
    const response = await handleCreateReport(post({ text: sampleText("r5") }), deps);
    expect(response.status).toBe(201);
    const body = (await response.json()) as { work_orders: Array<{ issue_type: string; needs_followup: boolean }> };
    expect(body.work_orders).toEqual([expect.objectContaining({ issue_type: "Other", needs_followup: true })]);
  });
});
```

`src/lib/api/update-status.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { WorkOrderRow } from "@/lib/db/types";
import { handleUpdateStatus } from "./update-status";

const ID = "0b9f4c7e-6a51-4c1e-9d3a-2f6b8e1a7c55";

function patch(body: unknown) {
  return new Request(`http://localhost/api/work-orders/${ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function storeReturning(row: Partial<WorkOrderRow> | null) {
  return { updateStatus: vi.fn(async () => (row === null ? null : ({ id: ID, ...row } as WorkOrderRow))) };
}

describe("PATCH /api/work-orders/:id", () => {
  it("updates the status", async () => {
    const store = storeReturning({ status: "In Progress" });
    const response = await handleUpdateStatus(patch({ status: "In Progress" }), ID, store);
    expect(response.status).toBe(200);
    expect(store.updateStatus).toHaveBeenCalledWith(ID, "In Progress");
  });

  it("rejects a status outside New / In Progress / Done", async () => {
    const store = storeReturning({ status: "New" });
    const response = await handleUpdateStatus(patch({ status: "Closed" }), ID, store);
    expect(response.status).toBe(400);
    expect(store.updateStatus).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed id without touching the database", async () => {
    const store = storeReturning(null);
    const response = await handleUpdateStatus(patch({ status: "Done" }), "not-a-uuid", store);
    expect(response.status).toBe(404);
    expect(store.updateStatus).not.toHaveBeenCalled();
  });

  it("returns 404 when no work order has that id", async () => {
    const response = await handleUpdateStatus(patch({ status: "Done" }), ID, storeReturning(null));
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/api`
Expected: FAIL — cannot resolve `./http`, `./create-report`, `./update-status`.

- [ ] **Step 3: Implement `http.ts` and `client-ip.ts`**

`src/lib/api/http.ts`:

```ts
export type ErrorCode = "invalid_input" | "rate_limited" | "not_found" | "unauthorized" | "internal";

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  not_found: 404,
  rate_limited: 429,
  internal: 500,
};

export function errorResponse(code: ErrorCode, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status: STATUS[code], headers });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function withErrorBoundary<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(error);
      return errorResponse("internal", "Something went wrong on our side. Please try again.");
    }
  };
}
```

`src/lib/api/client-ip.ts`:

```ts
import { createHash } from "node:crypto";

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
```

- [ ] **Step 4: Implement the handlers**

`src/lib/api/create-report.ts`:

```ts
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

const bodySchema = z.object({ text: z.string() });

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

  const allowed = await deps.store.allowIntake(deps.hashIp(clientIp(req.headers)), deps.maxPerMinute);
  if (!allowed) {
    return errorResponse("rate_limited", "Too many reports from this address. Wait a minute and try again.", {
      "Retry-After": "60",
    });
  }

  const result = await runTriage(
    { text: normalized.text, source: "text", callerLast4: null, vapiCallId: null },
    deps.extract,
  );
  const saved = await deps.store.saveTriage(result);
  if (!saved) return errorResponse("internal", "The report could not be saved.");
  return Response.json({ report: saved.report, work_orders: saved.workOrders }, { status: 201 });
}
```

`src/lib/api/update-status.ts`:

```ts
import { z } from "zod";
import type { TriageStore } from "@/lib/db/store";
import { STATUSES } from "@/lib/triage/schema";
import { errorResponse, readJson } from "./http";

const idSchema = z.uuid();
const bodySchema = z.object({ status: z.enum(STATUSES) });

export async function handleUpdateStatus(
  req: Request,
  id: string,
  store: Pick<TriageStore, "updateStatus">,
): Promise<Response> {
  if (!idSchema.safeParse(id).success) return errorResponse("not_found", "No work order with that id.");

  const body = bodySchema.safeParse(await readJson(req));
  if (!body.success) {
    return errorResponse("invalid_input", `Status must be one of: ${STATUSES.join(", ")}.`);
  }

  const updated = await store.updateStatus(id, body.data.status);
  if (!updated) return errorResponse("not_found", "No work order with that id.");
  return Response.json({ work_order: updated });
}
```

- [ ] **Step 5: Run the handler tests**

Run: `pnpm vitest run src/lib/api`
Expected: all tests PASS.

- [ ] **Step 6: Wire real dependencies and the routes**

`src/lib/api/deps.ts`:

```ts
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
    store: createServerStore(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY")),
    extract: createExtractor(
      new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") }),
      process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    ),
    hashIp: (ip) => hashIp(ip, salt),
    maxPerMinute: MAX_REPORTS_PER_MINUTE,
  };
  return cached;
}
```

`src/app/api/reports/route.ts`:

```ts
import { handleCreateReport } from "@/lib/api/create-report";
import { getDeps } from "@/lib/api/deps";
import { withErrorBoundary } from "@/lib/api/http";

export const maxDuration = 60;

export const POST = withErrorBoundary((req: Request) => handleCreateReport(req, getDeps()));
```

`src/app/api/work-orders/[id]/route.ts`:

```ts
import { getDeps } from "@/lib/api/deps";
import { withErrorBoundary } from "@/lib/api/http";
import { handleUpdateStatus } from "@/lib/api/update-status";

export const PATCH = withErrorBoundary(
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return handleUpdateStatus(req, id, getDeps().store);
  },
);
```

- [ ] **Step 7: Verify end to end against the running app**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm dev &                       # wait for "Ready"
curl -s -X POST http://localhost:3000/api/reports -H 'Content-Type: application/json' \
  -d '{"text":"Unit 9F. Water is pouring through the kitchen ceiling light fixture!"}'
```

Expected: HTTP 201 JSON with one work order, priority `Emergency`, `priority_source` a `rule:` value, unit `9F`. Copy its `id`, then:

```bash
curl -s -X PATCH "http://localhost:3000/api/work-orders/<id>" -H 'Content-Type: application/json' -d '{"status":"In Progress"}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/reports -H 'Content-Type: application/json' -d '{"text":""}'
```

Expected: the PATCH returns the work order with `"status":"In Progress"`; the empty report returns `400`. Stop the dev server. Delete the test report:

```bash
set -a; . ./.env.local; set +a
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/reports?raw_text=like.Unit%209F*" -H "apikey: $SUPABASE_SECRET_KEY"
```

- [ ] **Step 8: Commit**

```bash
pnpm format
git add src/lib/api/ src/app/api/
git commit -q -F - <<'EOF'
Expose report intake and status updates as API routes

Handlers take their dependencies as arguments, so tests cover
validation, rate limiting and the fallback path without the network.
One error boundary at the HTTP edge returns JSON 500s without leaking
internals.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 12: Publish the repository and open the first pull request

**Needs Rafael's explicit go-ahead in this session before Step 2** — creating a public repo publishes code (Claude Code's permission check blocks it otherwise).

- [ ] **Step 1: Final local checks**

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
git log --oneline main..feat/triage-core       # ~12 commits, one per task step that commits
git log -p --all | grep -ciE "sk-ant-[a-z0-9_-]{20}|sb_secret_[a-z0-9_-]{16}|sbp_[a-f0-9]{20}" || true   # expected: 0
git ls-files '*.pdf' '*.docx'                                                                            # expected: no output
```

- [ ] **Step 2: Create the public repo and push**

```bash
GH="$LOCALAPPDATA/Programs/gh/bin/gh.exe"
"$GH" repo create Historfic/workspark-maintenance --public \
  --description "Tenant maintenance calls in, AI-triaged work orders out, on a realtime dashboard. Next.js, Supabase, Claude, Vapi." \
  --source . --remote origin
git push -u origin main
git push -u origin feat/triage-core
```

- [ ] **Step 3: Open the pull request**

```bash
"$GH" pr create --base main --head feat/triage-core --title "Triage core: pipeline, database and API" --body-file - <<'EOF'
## What
The backend half of the prototype: report text in, validated work orders out.

- Claude Fable 5.1 extracts one or more issues per report with structured output.
- Code enforces "never guess": a unit survives only if the report states it; quotes must be verbatim.
- Raise-only safety rules (gas, water + electrical, fire/smoke, flooding, no heat in the cold) put a floor under the model's priority and record which rule decided.
- Failed extraction still saves the report with a manual-review ticket.
- Supabase schema with read-only browser access; writes go through two server-only functions.
- `POST /api/reports`, `PATCH /api/work-orders/:id`, rate limited by hashed IP.

## Why
The brief weights end-to-end function (30%) and extraction quality on messy reports (25%) highest. This PR makes both verifiable before any UI exists.

## How it was tested
- Unit tests: normalization, grounding, rules (including near misses), pipeline retry/fallback, the request sent to Anthropic, and both route handlers.
- `pnpm eval` against the real model: results for all five sample reports are in `docs/walkthrough.md`.
- Live checks against Supabase: the publishable key can read but not write; duplicate call ids are ignored.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 4: Wait for CI**

Run: `"$GH" pr checks --watch`
Expected: the `check` job passes. If it fails, read the log (`"$GH" run view --log-failed`), fix on the branch, push, and wait again.

Do not merge yet: Task 13 deploys this branch's code first. Merge after Task 13 with `"$GH" pr merge --merge`.

---

### Task 13: Deploy to Vercel (production) and smoke-test the API

**Needs Rafael's explicit go-ahead in this session** — a production deployment is a public URL.

- [ ] **Step 1: Link the project and connect GitHub**

```bash
vercel --version
vercel link --yes --project workspark-maintenance
vercel git connect https://github.com/Historfic/workspark-maintenance
```

If `vercel git connect` reports the Vercel GitHub app is not installed for `Historfic`, give Rafael the install link it prints, wait for him, and rerun.

- [ ] **Step 2: Add environment variables without printing them**

Run `vercel env add --help` first and confirm how to target environments non-interactively in this CLI version. Then, for production and preview, add each of: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RATE_LIMIT_SALT`, `VAPI_WEBHOOK_SECRET`. Read values from `.env.local` and pipe them on stdin, for example:

```bash
set -a; . ./.env.local; set +a
for name in ANTHROPIC_API_KEY NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY RATE_LIMIT_SALT VAPI_WEBHOOK_SECRET; do
  printf '%s' "${!name}" | vercel env add "$name" production >/dev/null && echo "production: $name added"
done
vercel env ls
```

Repeat for `preview` per the CLI's help. Do **not** add `DATABASE_URL` or `VAPI_PRIVATE_KEY` (local scripts only). The Vapi public key, assistant id and phone number are added in Plan 3 once the restricted key exists.

- [ ] **Step 3: Deploy and smoke-test**

```bash
vercel deploy --prod --yes
PROD="https://<production-domain-printed-above>"
curl -s -X POST "$PROD/api/reports" -H 'Content-Type: application/json' \
  -d '{"text":"This is 2D. My bedroom window won'"'"'t close all the way. Not urgent, whenever you get a chance."}'
```

Expected: HTTP 201 with one `Structural` / `Low` work order for unit `2D`. Note the response time; the function runs in `icn1` (check the deployment's function region in `vercel inspect`).

Delete the smoke-test report via the Supabase REST API with the secret key (same pattern as Task 11 Step 7), then record the production URL in `CLAUDE.md` under "Setup state" and commit:

```bash
git add CLAUDE.md
git commit -q -m "Record the production URL" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: Merge the pull request**

```bash
"$GH" pr checks --watch
"$GH" pr merge --merge --delete-branch
git checkout main && git pull
```

Update the Status list in `CLAUDE.md`: Phase 0, Phase 1 and Phase 2 done (commit on `main` directly: "Mark the triage core phases done").

---

## Self-review against the spec

| Spec section | Covered by |
|---|---|
| 1 Success criteria (five reports, eval, walkthrough table) | Tasks 2, 8, 10 |
| 2 Architecture, module layout, Seoul region | Tasks 1 (vercel.json), 2–11 |
| 3.1 Pipeline steps, retry once, fallback ticket | Tasks 3, 6, 7 |
| 3.2 Output schema | Task 2 |
| 3.3 Grounding (unit, quote, urgency quote, notes) | Task 4 |
| 3.4 Safety rules, policy of record, ties | Task 5 |
| 3.5 Prompt, versioning | Task 6 |
| 4 Data model, RLS, grants, functions, realtime | Task 9 |
| 5 API, error shape, rate limit | Task 11 |
| 6 Voice | Plan 3 (webhook route, Vapi setup, restricted key) |
| 7 Dashboard and visual system | Plan 2 |
| 8 Security | Tasks 1 (env), 9 (RLS/grants), 11 (rate limit, error boundary); Plan 3 (webhook secret) |
| 9 Testing and eval, CI | Tasks 1, 3–8, 11 |
| 10 Config and deployment | Tasks 1, 13 |

Deviation from the spec, recorded here: `priority_source` also allows `'fallback'` (spec section 4 listed only `model` and `rule:%`), because the manual-review ticket must say that no model or rule decided its priority. The migration runner replaces the Supabase CLI for the reasons given in Task 9.
