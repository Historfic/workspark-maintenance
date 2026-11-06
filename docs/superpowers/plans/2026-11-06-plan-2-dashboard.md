# Plan 2 — Dashboard: intake panel, work-order table, drawer, realtime

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementation subagents run on `model: "fable"` (CLAUDE.md decision 5). Load `ui-ux-pro-max` before any UI task.

**Goal:** The single-page property-manager dashboard from spec §7: submit a report (typed or a sample), watch tickets arrive live, filter them, change status, and open a drawer that explains every ticket's priority.

**Architecture:** A server component loads the initial work orders with the publishable key; a client shell owns the list state, subscribes to Supabase Realtime (`postgres_changes` on `work_orders`), and renders the intake panel, filter tabs, table/cards and drawer. All view logic that can be a pure function (sorting, filtering, counts, relative time, quote highlighting, optimistic status) lives in `src/lib/dashboard/` with Vitest tests; components stay thin. Writes go through the existing API routes. Accessible primitives come from Radix (`radix-ui` unified package) styled with the project's own tokens — **not shadcn** (deviation from spec §7.2, recorded in the self-review).

**Tech Stack:** Next.js 16.4.5 App Router (server + client components), React 19.3.1, Tailwind 4.3.4 (`@theme` tokens), `radix-ui` 1.8.1, `@phosphor-icons/react` 2.1.10, `clsx` 2.1.1, `@supabase/supabase-js` 2.119.0 (browser client, Realtime), `next/font/google` (Fira Sans, Fira Code), Vitest 5.1.0, Zod 4.6.7.

Spec: `docs/superpowers/specs/2026-11-05-maintenance-triage-design.md` §7 (dashboard), §2 (reads use the publishable key), §5 (API). Plan 1 delivered the API, store and schema this plan consumes.

## Global Constraints

- Branch `feat/dashboard` from `main` **after the Plan 1 PR has merged**. One PR at the end; merge with a merge commit.
- Exact versions, no `^`/`~`: `radix-ui` 1.8.1, `@phosphor-icons/react` 2.1.10, `clsx` 2.1.1. New releases younger than pnpm's release-age window must be listed in `pnpm-workspace.yaml` `minimumReleaseAgeExclude` (Plan 1 did this for Supabase/Anthropic/Vite).
- Visual system (spec §7.2, look A "property office") — tokens exactly:
  `--color-bg #F6F5F1`, `--color-surface #FFFFFF`, `--color-ink #0F172A`, `--color-ink-muted #475569`, `--color-line #E4E2DC`, `--color-accent #0369A1`, `--color-emergency #B91C1C`, `--color-followup #B45309`, `--color-followup-bg #FEF3C7`, `--color-followup-line #D97706`, `--color-done #15803D`, `--color-done-bg #DCFCE7`. Fira Sans 400/500/600 for interface text; Fira Code 400/500 for unit numbers, ids, times, JSON. 4 px radius, 1 px borders, one shadow level (drawer only). No gradients, no blur, no default-gray framework look. **Red appears only on the Emergency badge.** Every coloured badge also carries a text label (never colour alone).
- Priority badges: Emergency = solid red, white text, warning icon; High = solid ink, white text; Medium = ink outline; Low = muted text with a leading dot. Follow-up rows: 3 px amber (`followup-line`) left border and an amber "Unit unknown" tag when `unit` is null. Done status uses `done`/`done-bg`.
- Accessibility (ui-ux-pro-max §1–2): every control keyboard reachable with a visible focus ring (2 px accent); interactive targets ≥ 24×24 CSS px on desktop and ≥ 44 px tall on the mobile card layout; text contrast ≥ 4.5:1 (`ink-muted` on `surface` is 7.4:1); the drawer traps focus and closes on Esc; new tickets are announced through one `aria-live="polite"` region; all motion disabled under `prefers-reduced-motion`. Icons from Phosphor only (no emoji), regular weight, 20 px, `aria-hidden` when next to text.
- Table sort: Emergency, High, Medium, Low; newest first within a priority. Filters: All · Emergency · Needs follow-up · New · In Progress · Done, each tab showing its live count.
- Mobile (< 768 px): intake panel stacks above; tickets render as cards; no horizontal scroll at 375 px.
- Realtime via the publishable key (RLS allows SELECT only). Reads never use the secret key. Payloads are **Zod-parsed**, never cast (`no as`, `no any`, no non-null assertions in source; tests may).
- TypeScript strict + `noUncheckedIndexedAccess`; files under ~200 lines, one job each; no narrating comments; no blanket try/catch (one boundary per fetch call that converts a failed response into UI state).
- Tests: Vitest on the pure view-model modules (no DOM library). Components are verified in Task 8 by clicking through the running app with `agent-browser`, with the exact observations listed there. No snapshot tests.
- Before every commit: `pnpm format`; `git diff --cached` checked for secrets; `.env.local` never staged. Commit trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; imperative subject ≤ 72 chars; body explains *why* when non-obvious.
- Shell is Git Bash on Windows; always quote the repo path, which contains a non-ASCII character. A dev server may already be running on :3000 — reuse it, never start a second one.

## File map

```
src/app/layout.tsx                      — fonts, metadata, body tokens (Task 1)
src/app/globals.css                     — Tailwind import + @theme tokens + base styles (Task 1)
src/app/page.tsx                        — server component: initial load → <Dashboard> (Task 7)
src/app/loading.tsx                     — route-level skeleton (Task 7)
src/app/error.tsx                       — route-level error state with retry (Task 7)
src/lib/db/row-schemas.ts               — Zod schemas for WorkOrderRow / ReportRow (Task 2)
src/lib/db/browser-client.ts            — createClient with the publishable key (Task 3)
src/lib/db/public-reads.ts              — listWorkOrders, fetchReportBundle (Task 3)
src/lib/dashboard/filters.ts            — FILTERS, matchesFilter, countFilters (Task 2)
src/lib/dashboard/ordering.ts           — sortWorkOrders (Task 2)
src/lib/dashboard/time.ts               — relativeTime (Task 2)
src/lib/dashboard/highlight.ts          — quoteRange (Task 2)
src/lib/dashboard/feed-reducer.ts       — feed state + reducer: upsert, status, highlight (Task 2)
src/lib/dashboard/labels.ts             — priority/status/source/type display tables (Task 5)
src/hooks/use-work-orders-feed.ts       — Realtime subscription hook (Task 3)
src/components/ui/button.tsx, textarea.tsx, badge.tsx, visually-hidden.tsx (Task 1)
src/components/intake/intake-panel.tsx, sample-chips.tsx, intake-result.tsx (Task 4)
src/components/orders/priority-badge.tsx, type-icon.tsx, unit-chip.tsx, status-control.tsx,
  filter-tabs.tsx, work-order-row.tsx, work-order-card.tsx, work-order-list.tsx (Task 5)
src/components/orders/order-drawer.tsx, drawer-sections.tsx (Task 6)
src/components/dashboard.tsx, live-indicator.tsx, page-header.tsx (Task 7)
docs/screenshots/*.png                  — captured in Task 8
```

---

### Task 1: UI foundation — fonts, tokens, base primitives

**Files:**
- Modify: `package.json`, `pnpm-workspace.yaml` (only if pnpm demands an exclusion), `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/ui/button.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/visually-hidden.tsx`

**Interfaces:**
- Produces: Tailwind utilities `bg-bg`, `bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`, `text-emergency`, etc.; `font-sans` (Fira Sans), `font-mono` (Fira Code); `rounded` = 4 px.
- `Button({ variant: "primary" | "secondary" | "ghost", size?: "md" | "sm", ...buttonProps })`; `Textarea(props)` (styled, 100 % width); `Badge({ tone: "neutral" | "emergency" | "ink" | "outline" | "muted" | "followup" | "done", children })`; `VisuallyHidden({ children })`.

- [ ] **Step 1: Branch and install**

```bash
cd "<repo>"
git checkout main && git pull && git checkout -b feat/dashboard
pnpm add radix-ui@1.8.1 @phosphor-icons/react@2.1.10 clsx@2.1.1
```

Expected: `package.json` gains the three exact versions. If pnpm refuses one for release age, add `"<pkg>@<version>"` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and rerun.

- [ ] **Step 2: Tokens and base styles**

`src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg: #f6f5f1;
  --color-surface: #ffffff;
  --color-ink: #0f172a;
  --color-ink-muted: #475569;
  --color-line: #e4e2dc;
  --color-accent: #0369a1;
  --color-emergency: #b91c1c;
  --color-followup: #b45309;
  --color-followup-bg: #fef3c7;
  --color-followup-line: #d97706;
  --color-done: #15803d;
  --color-done-bg: #dcfce7;

  --font-sans: var(--font-fira-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-fira-code), ui-monospace, "SFMono-Regular", monospace;

  --radius-DEFAULT: 4px;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
}

@layer base {
  html {
    color-scheme: light;
  }
  body {
    @apply bg-bg text-ink font-sans antialiased;
    font-size: 15px;
    line-height: 1.5;
  }
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@keyframes row-arrive {
  from {
    background-color: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface));
  }
  to {
    background-color: var(--color-surface);
  }
}
.row-arrive {
  animation: row-arrive 1.2s ease-out 1;
}
```

- [ ] **Step 3: Fonts and layout**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Workspark Maintenance",
  description: "Tenant maintenance reports in, triaged work orders out.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Base primitives**

`src/components/ui/button.tsx`:

```tsx
import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-[#02507c] disabled:bg-ink-muted/40",
  secondary: "border border-line bg-surface text-ink hover:bg-bg disabled:text-ink-muted/60",
  ghost: "text-accent hover:bg-accent/10 disabled:text-ink-muted/60",
};

const SIZE: Record<Size, string> = {
  md: "h-10 px-4 text-[15px]",
  sm: "h-8 px-3 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
}
```

`src/components/ui/textarea.tsx`:

```tsx
import { clsx } from "clsx";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full resize-y rounded border border-line bg-surface px-3 py-2 text-[15px] leading-6 text-ink placeholder:text-ink-muted/70 disabled:bg-bg",
        className,
      )}
      {...props}
    />
  );
}
```

`src/components/ui/badge.tsx`:

```tsx
import { clsx } from "clsx";
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "emergency" | "ink" | "outline" | "muted" | "followup" | "done";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-bg text-ink border border-line",
  emergency: "bg-emergency text-white",
  ink: "bg-ink text-white",
  outline: "border border-ink text-ink",
  muted: "text-ink-muted",
  followup: "bg-followup-bg text-followup border border-followup-line",
  done: "bg-done-bg text-done",
};

export function Badge({ tone, className, children }: { tone: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium tracking-wide uppercase whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

`src/components/ui/visually-hidden.tsx`:

```tsx
import type { ReactNode } from "react";

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm format
git add package.json pnpm-lock.yaml pnpm-workspace.yaml src/app/globals.css src/app/layout.tsx src/components/ui/
git commit -q -F - <<'EOF'
Set the dashboard's visual system: tokens, fonts, base controls

One deliberate direction instead of framework defaults: warm paper
background, ink text, a single blue accent, red reserved for Emergency.
Fira Sans for interface text and Fira Code for identifiers and times.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

(Only stage `pnpm-workspace.yaml` if it changed.) The placeholder page still renders with the new fonts and background — check http://localhost:3000 once.

---

### Task 2: Pure view-model modules (TDD)

**Files:**
- Create: `src/lib/db/row-schemas.ts`, `src/lib/dashboard/ordering.ts`, `src/lib/dashboard/filters.ts`, `src/lib/dashboard/time.ts`, `src/lib/dashboard/highlight.ts`, `src/lib/dashboard/feed-reducer.ts`
- Test: `src/lib/dashboard/ordering.test.ts`, `filters.test.ts`, `time.test.ts`, `highlight.test.ts`, `feed-reducer.test.ts`, `src/lib/db/row-schemas.test.ts`
- Modify: `src/test/fixtures.ts` (add `makeWorkOrderRow`)

**Interfaces:**
- `row-schemas.ts`: `workOrderRowSchema: z.ZodType<WorkOrderRow>`, `reportRowSchema: z.ZodType<ReportRow>`, `parseWorkOrderRow(input: unknown): WorkOrderRow | null`.
- `ordering.ts`: `sortWorkOrders(rows: readonly WorkOrderRow[]): WorkOrderRow[]` — priority rank desc, then `created_at` desc; stable; does not mutate.
- `filters.ts`: `type FilterKey = "all" | "emergency" | "followup" | "new" | "in_progress" | "done"`; `FILTERS: ReadonlyArray<{ key: FilterKey; label: string }>`; `matchesFilter(row, key): boolean`; `countFilters(rows): Record<FilterKey, number>`.
- `time.ts`: `relativeTime(iso: string, now: Date): string` → "just now", "3m ago", "2h ago", "yesterday", "3d ago", else `Oct 4`.
- `highlight.ts`: `quoteRange(text: string, quote: string | null): { start: number; end: number } | null` — case-insensitive, curly-apostrophe-tolerant, whitespace-tolerant locate of the quote inside the text; null when absent.
- `feed-reducer.ts`: `interface FeedState { orders: WorkOrderRow[]; recentIds: string[]; announcement: string | null; connection: "connecting" | "live" | "reconnecting" }`, `type FeedAction = { type: "upsert"; row: WorkOrderRow; fromRealtime: boolean } | { type: "setStatus"; id: string; status: Status } | { type: "replace"; rows: WorkOrderRow[] } | { type: "connection"; value: FeedState["connection"] } | { type: "clearRecent"; id: string }`, `feedReducer(state, action): FeedState`, `initialFeedState(rows): FeedState`, `announceFor(row): string`.

- [ ] **Step 1: Fixture builder**

Append to `src/test/fixtures.ts`:

```ts
import type { WorkOrderRow } from "@/lib/db/types";

export function makeWorkOrderRow(overrides: Partial<WorkOrderRow> = {}): WorkOrderRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    report_id: "22222222-2222-4222-8222-222222222222",
    position: 0,
    issue_type: "Plumbing",
    priority: "Medium",
    model_priority: "Medium",
    priority_source: "model",
    priority_reason: "Impairs normal use of the kitchen.",
    model_rationale: "Impairs normal use of the kitchen.",
    unit: "12C",
    area: "kitchen",
    summary: "Kitchen sink is clogged.",
    source_quote: "The kitchen sink is clogged",
    missing_fields: [],
    grounding_notes: [],
    needs_followup: false,
    status: "New",
    created_at: "2026-11-06T10:00:00.000Z",
    updated_at: "2026-11-06T10:00:00.000Z",
    ...overrides,
  };
}
```

(Keep the existing imports at the top of the file; add this import there.)

- [ ] **Step 2: Failing tests**

`src/lib/dashboard/ordering.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { sortWorkOrders } from "./ordering";

describe("sortWorkOrders", () => {
  it("puts Emergency first, then High, Medium, Low", () => {
    const rows = [
      makeWorkOrderRow({ id: "low", priority: "Low" }),
      makeWorkOrderRow({ id: "em", priority: "Emergency" }),
      makeWorkOrderRow({ id: "med", priority: "Medium" }),
      makeWorkOrderRow({ id: "high", priority: "High" }),
    ];
    expect(sortWorkOrders(rows).map((r) => r.id)).toEqual(["em", "high", "med", "low"]);
  });

  it("orders newest first within a priority and leaves the input untouched", () => {
    const older = makeWorkOrderRow({ id: "older", created_at: "2026-11-06T09:00:00.000Z" });
    const newer = makeWorkOrderRow({ id: "newer", created_at: "2026-11-06T11:00:00.000Z" });
    const input = [older, newer];
    expect(sortWorkOrders(input).map((r) => r.id)).toEqual(["newer", "older"]);
    expect(input.map((r) => r.id)).toEqual(["older", "newer"]);
  });
});
```

`src/lib/dashboard/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { countFilters, FILTERS, matchesFilter } from "./filters";

const rows = [
  makeWorkOrderRow({ id: "a", priority: "Emergency", status: "New" }),
  makeWorkOrderRow({ id: "b", priority: "High", status: "In Progress", unit: null, needs_followup: true }),
  makeWorkOrderRow({ id: "c", priority: "Low", status: "Done" }),
];

describe("filters", () => {
  it("lists the six filters in display order", () => {
    expect(FILTERS.map((f) => f.key)).toEqual(["all", "emergency", "followup", "new", "in_progress", "done"]);
  });

  it("matches by priority, follow-up flag and status", () => {
    expect(rows.filter((r) => matchesFilter(r, "all")).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(rows.filter((r) => matchesFilter(r, "emergency")).map((r) => r.id)).toEqual(["a"]);
    expect(rows.filter((r) => matchesFilter(r, "followup")).map((r) => r.id)).toEqual(["b"]);
    expect(rows.filter((r) => matchesFilter(r, "in_progress")).map((r) => r.id)).toEqual(["b"]);
    expect(rows.filter((r) => matchesFilter(r, "done")).map((r) => r.id)).toEqual(["c"]);
  });

  it("counts every filter", () => {
    expect(countFilters(rows)).toEqual({ all: 3, emergency: 1, followup: 1, new: 1, in_progress: 1, done: 1 });
  });
});
```

`src/lib/dashboard/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { relativeTime } from "./time";

const now = new Date("2026-11-06T12:00:00.000Z");

describe("relativeTime", () => {
  it.each([
    ["2026-11-06T11:59:40.000Z", "just now"],
    ["2026-11-06T11:57:00.000Z", "3m ago"],
    ["2026-11-06T10:00:00.000Z", "2h ago"],
    ["2026-11-05T13:00:00.000Z", "yesterday"],
    ["2026-11-03T12:00:00.000Z", "3d ago"],
    ["2026-10-04T12:00:00.000Z", "Oct 4"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
```

`src/lib/dashboard/highlight.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleText } from "@/test/fixtures";
import { quoteRange } from "./highlight";

describe("quoteRange", () => {
  it("finds a verbatim quote", () => {
    const text = sampleText("r3");
    const range = quoteRange(text, "The kitchen sink is clogged");
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe("The kitchen sink is clogged");
  });

  it("tolerates case, curly apostrophes and extra spaces", () => {
    const text = sampleText("r1");
    const range = quoteRange(text, "IT’S  DRIPPING onto the outlet");
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe("it's dripping onto the outlet");
  });

  it("returns null for a missing or empty quote", () => {
    expect(quoteRange(sampleText("r5"), "the roof leaks")).toBeNull();
    expect(quoteRange(sampleText("r5"), null)).toBeNull();
    expect(quoteRange(sampleText("r5"), "   ")).toBeNull();
  });
});
```

`src/lib/dashboard/feed-reducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { announceFor, feedReducer, initialFeedState } from "./feed-reducer";

const a = makeWorkOrderRow({ id: "a", priority: "Low" });
const b = makeWorkOrderRow({ id: "b", priority: "Emergency", issue_type: "Gas", unit: "7A" });

describe("feedReducer", () => {
  it("inserts a realtime row, marks it recent and announces it", () => {
    const next = feedReducer(initialFeedState([a]), { type: "upsert", row: b, fromRealtime: true });
    expect(next.orders.map((r) => r.id)).toEqual(["b", "a"]);
    expect(next.recentIds).toEqual(["b"]);
    expect(next.announcement).toBe("New Emergency ticket: Gas, unit 7A");
  });

  it("replaces an existing row in place without re-announcing", () => {
    const state = initialFeedState([a, b]);
    const next = feedReducer(state, { type: "upsert", row: { ...a, status: "Done" }, fromRealtime: true });
    expect(next.orders.find((r) => r.id === "a")?.status).toBe("Done");
    expect(next.recentIds).toEqual([]);
    expect(next.announcement).toBeNull();
  });

  it("does not mark rows recent when the insert came from this tab", () => {
    const next = feedReducer(initialFeedState([]), { type: "upsert", row: b, fromRealtime: false });
    expect(next.recentIds).toEqual([]);
  });

  it("applies and can revert a status locally", () => {
    const applied = feedReducer(initialFeedState([a]), { type: "setStatus", id: "a", status: "In Progress" });
    expect(applied.orders[0]?.status).toBe("In Progress");
    const reverted = feedReducer(applied, { type: "setStatus", id: "a", status: "New" });
    expect(reverted.orders[0]?.status).toBe("New");
  });

  it("tracks connection state and clears recent ids", () => {
    const s1 = feedReducer(initialFeedState([]), { type: "connection", value: "reconnecting" });
    expect(s1.connection).toBe("reconnecting");
    const s2 = feedReducer({ ...s1, recentIds: ["b"] }, { type: "clearRecent", id: "b" });
    expect(s2.recentIds).toEqual([]);
  });

  it("announces a follow-up ticket with 'unit unknown'", () => {
    expect(announceFor(makeWorkOrderRow({ priority: "High", issue_type: "HVAC", unit: null }))).toBe(
      "New High ticket: HVAC, unit unknown",
    );
  });
});
```

`src/lib/db/row-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { parseWorkOrderRow } from "./row-schemas";

describe("parseWorkOrderRow", () => {
  it("accepts a well-formed row", () => {
    const row = makeWorkOrderRow();
    expect(parseWorkOrderRow(row)).toEqual(row);
  });

  it("rejects an unknown status or a missing id", () => {
    expect(parseWorkOrderRow({ ...makeWorkOrderRow(), status: "Closed" })).toBeNull();
    const { id: _id, ...noId } = makeWorkOrderRow();
    expect(parseWorkOrderRow(noId)).toBeNull();
  });
});
```

Run: `pnpm vitest run src/lib/dashboard src/lib/db/row-schemas.test.ts` → FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/lib/db/row-schemas.ts`:

```ts
import { z } from "zod";
import {
  CALLER_URGENCIES,
  GROUNDING_NOTES,
  ISSUE_TYPES,
  MISSING_FIELDS,
  PRIORITIES,
  RULE_NAMES,
  SOURCES,
  STATUSES,
} from "@/lib/triage/schema";
import { extractionSchema } from "@/lib/triage/schema";
import type { ReportRow, WorkOrderRow } from "./types";

const prioritySource = z.union([
  z.literal("model"),
  z.literal("fallback"),
  ...RULE_NAMES.map((name) => z.literal(`rule:${name}` as const)),
]);

export const workOrderRowSchema: z.ZodType<WorkOrderRow> = z.object({
  id: z.uuid(),
  report_id: z.uuid(),
  position: z.number().int(),
  issue_type: z.enum(ISSUE_TYPES),
  priority: z.enum(PRIORITIES),
  model_priority: z.enum(PRIORITIES).nullable(),
  priority_source: prioritySource,
  priority_reason: z.string(),
  model_rationale: z.string().nullable(),
  unit: z.string().nullable(),
  area: z.string().nullable(),
  summary: z.string(),
  source_quote: z.string().nullable(),
  missing_fields: z.array(z.enum(MISSING_FIELDS)),
  grounding_notes: z.array(z.enum(GROUNDING_NOTES)),
  needs_followup: z.boolean(),
  status: z.enum(STATUSES),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reportRowSchema: z.ZodType<ReportRow> = z.object({
  id: z.uuid(),
  created_at: z.string(),
  source: z.enum(SOURCES),
  raw_text: z.string(),
  caller_last4: z.string().nullable(),
  vapi_call_id: z.string().nullable(),
  caller_stated_urgency: z.enum(CALLER_URGENCIES).nullable(),
  caller_urgency_quote: z.string().nullable(),
  extraction_status: z.enum(["ok", "fallback"]),
  model: z.string().nullable(),
  prompt_version: z.string(),
  llm_output: extractionSchema.nullable(),
  latency_ms: z.number().int().nullable(),
  error: z.string().nullable(),
});

export function parseWorkOrderRow(input: unknown): WorkOrderRow | null {
  const result = workOrderRowSchema.safeParse(input);
  return result.success ? result.data : null;
}
```

If `z.ZodType<WorkOrderRow>` rejects the object schema because of the template-literal union, type `prioritySource` as `z.ZodType<PrioritySource>` (import from `@/lib/triage/types`) and keep the annotation; never cast.

`src/lib/dashboard/ordering.ts`:

```ts
import type { WorkOrderRow } from "@/lib/db/types";
import { priorityRank } from "@/lib/triage/schema";

export function sortWorkOrders(rows: readonly WorkOrderRow[]): WorkOrderRow[] {
  return [...rows].sort((a, b) => {
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
    if (byPriority !== 0) return byPriority;
    return b.created_at.localeCompare(a.created_at);
  });
}
```

`src/lib/dashboard/filters.ts`:

```ts
import type { WorkOrderRow } from "@/lib/db/types";

export type FilterKey = "all" | "emergency" | "followup" | "new" | "in_progress" | "done";

export const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "emergency", label: "Emergency" },
  { key: "followup", label: "Needs follow-up" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export function matchesFilter(row: WorkOrderRow, key: FilterKey): boolean {
  switch (key) {
    case "all":
      return true;
    case "emergency":
      return row.priority === "Emergency";
    case "followup":
      return row.needs_followup;
    case "new":
      return row.status === "New";
    case "in_progress":
      return row.status === "In Progress";
    case "done":
      return row.status === "Done";
  }
}

export function countFilters(rows: readonly WorkOrderRow[]): Record<FilterKey, number> {
  const counts: Record<FilterKey, number> = { all: 0, emergency: 0, followup: 0, new: 0, in_progress: 0, done: 0 };
  for (const row of rows) {
    for (const { key } of FILTERS) if (matchesFilter(row, key)) counts[key] += 1;
  }
  return counts;
}
```

`src/lib/dashboard/time.ts`:

```ts
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso));
}
```

`src/lib/dashboard/highlight.ts`:

```ts
function canonicalChar(char: string): string {
  if (char === "\u2018" || char === "\u2019" || char === "\u201B") return "'";
  if (char === "\u201C" || char === "\u201D") return '"';
  return char.toLowerCase();
}

// Maps each canonical character back to its index in the original text so a match can be
// translated into an exact slice of the original.
function canonicalize(text: string): { canonical: string; indexMap: number[] } {
  let canonical = "";
  const indexMap: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";
    if (/\s/.test(char)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      canonical += " ";
      indexMap.push(i);
      continue;
    }
    lastWasSpace = false;
    canonical += canonicalChar(char);
    indexMap.push(i);
  }
  return { canonical, indexMap };
}

export function quoteRange(text: string, quote: string | null): { start: number; end: number } | null {
  if (quote === null) return null;
  const needle = canonicalize(quote).canonical.trim();
  if (needle.length === 0) return null;
  const { canonical, indexMap } = canonicalize(text);
  const at = canonical.indexOf(needle);
  if (at === -1) return null;
  const start = indexMap[at];
  const lastIndex = indexMap[at + needle.length - 1];
  if (start === undefined || lastIndex === undefined) return null;
  return { start, end: lastIndex + 1 };
}
```

`src/lib/dashboard/feed-reducer.ts`:

```ts
import type { WorkOrderRow } from "@/lib/db/types";
import type { Status } from "@/lib/triage/schema";
import { sortWorkOrders } from "./ordering";

export type Connection = "connecting" | "live" | "reconnecting";

export interface FeedState {
  orders: WorkOrderRow[];
  recentIds: string[];
  announcement: string | null;
  connection: Connection;
}

export type FeedAction =
  | { type: "upsert"; row: WorkOrderRow; fromRealtime: boolean }
  | { type: "setStatus"; id: string; status: Status }
  | { type: "replace"; rows: WorkOrderRow[] }
  | { type: "connection"; value: Connection }
  | { type: "clearRecent"; id: string };

export function initialFeedState(rows: readonly WorkOrderRow[]): FeedState {
  return { orders: sortWorkOrders(rows), recentIds: [], announcement: null, connection: "connecting" };
}

export function announceFor(row: WorkOrderRow): string {
  return `New ${row.priority} ticket: ${row.issue_type}, ${row.unit ? `unit ${row.unit}` : "unit unknown"}`;
}

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "upsert": {
      const exists = state.orders.some((row) => row.id === action.row.id);
      const orders = sortWorkOrders(
        exists ? state.orders.map((row) => (row.id === action.row.id ? action.row : row)) : [...state.orders, action.row],
      );
      const isNew = !exists && action.fromRealtime;
      return {
        ...state,
        orders,
        recentIds: isNew ? [...state.recentIds, action.row.id] : state.recentIds,
        announcement: isNew ? announceFor(action.row) : null,
      };
    }
    case "setStatus":
      return {
        ...state,
        orders: state.orders.map((row) => (row.id === action.id ? { ...row, status: action.status } : row)),
      };
    case "replace":
      return { ...state, orders: sortWorkOrders(action.rows) };
    case "connection":
      return { ...state, connection: action.value };
    case "clearRecent":
      return { ...state, recentIds: state.recentIds.filter((id) => id !== action.id) };
  }
}
```

- [ ] **Step 4: Run tests, gates, commit**

```bash
pnpm vitest run src/lib/dashboard src/lib/db/row-schemas.test.ts   # all PASS
pnpm test && pnpm typecheck && pnpm lint
pnpm format
git add src/lib/db/row-schemas.ts src/lib/db/row-schemas.test.ts src/lib/dashboard/ src/test/fixtures.ts
git commit -q -F - <<'EOF'
Add the dashboard's view model as pure, tested functions

Sorting, filters and counts, relative time, quote highlighting and the
live-feed reducer are plain functions so the components stay thin and
the behaviour is tested without a DOM.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: Public reads and the Realtime feed hook

**Files:**
- Create: `src/lib/db/browser-client.ts`, `src/lib/db/public-reads.ts`, `src/hooks/use-work-orders-feed.ts`

**Interfaces:**
- `browser-client.ts`: `getBrowserClient(): SupabaseClient` (memoized; `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; throws a clear error if either is missing).
- `public-reads.ts`: `listWorkOrders(client, limit = 200): Promise<WorkOrderRow[]>` (parsed, invalid rows dropped), `fetchReportBundle(client, reportId): Promise<{ report: ReportRow; siblings: WorkOrderRow[] } | null>`.
- `use-work-orders-feed.ts`: `useWorkOrdersFeed(initial: WorkOrderRow[]): { state: FeedState; dispatch: Dispatch<FeedAction> }` — subscribes to `postgres_changes` INSERT and UPDATE on `public.work_orders`, parses payload rows, dispatches `upsert` with `fromRealtime: true`, maps channel status to `connection`, clears `recentIds` after 1.5 s, and unsubscribes on unmount.

- [ ] **Step 1: Browser client and reads**

`src/lib/db/browser-client.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
```

`src/lib/db/public-reads.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWorkOrderRow, reportRowSchema } from "./row-schemas";
import type { ReportRow, WorkOrderRow } from "./types";

function parseRows(data: unknown): WorkOrderRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const row = parseWorkOrderRow(item);
    return row ? [row] : [];
  });
}

export async function listWorkOrders(client: SupabaseClient, limit = 200): Promise<WorkOrderRow[]> {
  const { data, error } = await client
    .from("work_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load work orders: ${error.message}`);
  return parseRows(data);
}

export async function fetchReportBundle(
  client: SupabaseClient,
  reportId: string,
): Promise<{ report: ReportRow; siblings: WorkOrderRow[] } | null> {
  const [reportResult, siblingResult] = await Promise.all([
    client.from("reports").select("*").eq("id", reportId).maybeSingle(),
    client.from("work_orders").select("*").eq("report_id", reportId).order("position"),
  ]);
  if (reportResult.error) throw new Error(`Could not load the report: ${reportResult.error.message}`);
  if (siblingResult.error) throw new Error(`Could not load related tickets: ${siblingResult.error.message}`);
  const report = reportRowSchema.safeParse(reportResult.data);
  if (!report.success) return null;
  return { report: report.data, siblings: parseRows(siblingResult.data) };
}
```

- [ ] **Step 2: Realtime hook**

`src/hooks/use-work-orders-feed.ts`:

```ts
"use client";

import { useEffect, useReducer, type Dispatch } from "react";
import { getBrowserClient } from "@/lib/db/browser-client";
import { parseWorkOrderRow } from "@/lib/db/row-schemas";
import type { WorkOrderRow } from "@/lib/db/types";
import { feedReducer, initialFeedState, type FeedAction, type FeedState } from "@/lib/dashboard/feed-reducer";

const RECENT_MS = 1500;

export function useWorkOrdersFeed(initial: WorkOrderRow[]): { state: FeedState; dispatch: Dispatch<FeedAction> } {
  const [state, dispatch] = useReducer(feedReducer, initial, initialFeedState);

  useEffect(() => {
    const client = getBrowserClient();
    const channel = client
      .channel("work_orders_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "work_orders" }, (payload) => {
        const row = parseWorkOrderRow(payload.new);
        if (row) dispatch({ type: "upsert", row, fromRealtime: true });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "work_orders" }, (payload) => {
        const row = parseWorkOrderRow(payload.new);
        if (row) dispatch({ type: "upsert", row, fromRealtime: true });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") dispatch({ type: "connection", value: "live" });
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dispatch({ type: "connection", value: "reconnecting" });
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (state.recentIds.length === 0) return;
    const timers = state.recentIds.map((id) => setTimeout(() => dispatch({ type: "clearRecent", id }), RECENT_MS));
    return () => timers.forEach(clearTimeout);
  }, [state.recentIds]);

  return { state, dispatch };
}
```

If the SDK types `payload.new` such that `parseWorkOrderRow(payload.new)` does not compile, pass `payload.new as unknown`? No — `parseWorkOrderRow` takes `unknown`; any value is assignable to `unknown`, so no cast is needed. If the `.on("postgres_changes", …)` overload needs an explicit generic to compile, use `.on<Record<string, unknown>>(…)`.

- [ ] **Step 3: Gates and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm format
git add src/lib/db/browser-client.ts src/lib/db/public-reads.ts src/hooks/use-work-orders-feed.ts
git commit -q -F - <<'EOF'
Read work orders with the publishable key and follow changes live

The browser only ever reads: RLS limits the publishable key to select,
and every Realtime payload is parsed before it reaches state.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: Intake panel

**Files:**
- Create: `src/components/intake/intake-panel.tsx`, `src/components/intake/sample-chips.tsx`, `src/components/intake/intake-result.tsx`

**Interfaces:**
- `IntakePanel({ onCreated(orders: WorkOrderRow[]): void })` — client component. Posts `{ text }` to `/api/reports`; on 201 parses `work_orders` with `parseWorkOrderRow`, calls `onCreated`, shows `IntakeResult`; on error shows the API's `error.message` with a Retry button; disables Submit while pending with the label "Reading report…".
- `SampleChips({ disabled, onPick(text: string): void })` — one chip per `SAMPLE_REPORTS` entry, labelled by `label`; picking fills the textarea (does not auto-submit).
- `IntakeResult({ orders: WorkOrderRow[] })` — "Created N ticket(s)" with a compact line per ticket: priority badge, type, unit.

- [ ] **Step 1: Components**

`src/components/intake/sample-chips.tsx`:

```tsx
"use client";

import { SAMPLE_REPORTS } from "@/lib/triage/samples";

export function SampleChips({ disabled, onPick }: { disabled: boolean; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Sample reports">
      {SAMPLE_REPORTS.map((sample) => (
        <button
          key={sample.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(sample.text)}
          className="h-8 cursor-pointer rounded border border-line bg-surface px-3 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sample.label}
        </button>
      ))}
    </div>
  );
}
```

`src/components/intake/intake-result.tsx`:

```tsx
import type { WorkOrderRow } from "@/lib/db/types";
import { PriorityBadge } from "@/components/orders/priority-badge";

export function IntakeResult({ orders }: { orders: WorkOrderRow[] }) {
  return (
    <div role="status" className="rounded border border-line bg-bg p-3 text-sm">
      <p className="font-medium">
        Created {orders.length} ticket{orders.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 space-y-1.5">
        {orders.map((order) => (
          <li key={order.id} className="flex items-center gap-2">
            <PriorityBadge priority={order.priority} />
            <span>{order.issue_type}</span>
            <span className="font-mono text-ink-muted">{order.unit ?? "unit unknown"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

(`PriorityBadge` is created in Task 5. To keep this task green, create a minimal `src/components/orders/priority-badge.tsx` now with the final implementation from Task 5 Step 1 — copy it verbatim; Task 5 then only adds the other components.)

`src/components/intake/intake-panel.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseWorkOrderRow } from "@/lib/db/row-schemas";
import type { WorkOrderRow } from "@/lib/db/types";
import { MAX_REPORT_CHARS } from "@/lib/triage/normalize";
import { IntakeResult } from "./intake-result";
import { SampleChips } from "./sample-chips";

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; orders: WorkOrderRow[] }
  | { kind: "error"; message: string };

interface ApiError {
  error?: { message?: string };
}

interface ApiCreated {
  work_orders?: unknown[];
}

async function submitReport(text: string): Promise<WorkOrderRow[]> {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body ? (body as ApiError).error?.message : undefined;
    throw new Error(message ?? `The server answered ${response.status}.`);
  }
  const created = body && typeof body === "object" ? (body as ApiCreated).work_orders : undefined;
  return (created ?? []).flatMap((item) => {
    const row = parseWorkOrderRow(item);
    return row ? [row] : [];
  });
}

export function IntakePanel({ onCreated }: { onCreated: (orders: WorkOrderRow[]) => void }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = phase.kind === "submitting";
  const remaining = MAX_REPORT_CHARS - text.length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || text.trim().length === 0) return;
    setPhase({ kind: "submitting" });
    try {
      const orders = await submitReport(text);
      onCreated(orders);
      setPhase({ kind: "done", orders });
      setText("");
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong." });
    }
  }

  return (
    <section aria-labelledby="intake-heading" className="rounded border border-line bg-surface p-4">
      <h2 id="intake-heading" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
        New report
      </h2>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="report-text" className="block text-sm font-medium">
            What did the caller say?
          </label>
          <Textarea
            id="report-text"
            name="text"
            rows={5}
            maxLength={MAX_REPORT_CHARS}
            value={text}
            disabled={busy}
            onChange={(event) => setText(event.target.value)}
            placeholder="Hi, this is apartment 4B. There's water coming through the ceiling…"
            aria-describedby="report-help"
            className="mt-1"
          />
          <p id="report-help" className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>Paste or type the report as the tenant said it.</span>
            <span className="font-mono">{remaining}</span>
          </p>
        </div>
        <Button type="submit" disabled={busy || text.trim().length === 0} className="w-full">
          {busy ? "Reading report…" : "Submit report"}
        </Button>
      </form>
      <div className="mt-4">
        <p className="mb-2 text-xs text-ink-muted">Try one of the sample reports</p>
        <SampleChips disabled={busy} onPick={(sample) => setText(sample)} />
      </div>
      <div className="mt-4 min-h-6">
        {phase.kind === "done" && <IntakeResult orders={phase.orders} />}
        {phase.kind === "error" && (
          <div role="alert" className="rounded border border-emergency/40 bg-surface p-3 text-sm">
            <p className="font-medium">Couldn’t create the ticket</p>
            <p className="mt-1 text-ink-muted">{phase.message}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setPhase({ kind: "idle" })}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
```

The two `as ApiError` / `as ApiCreated` narrowings are the only casts allowed in this plan: they narrow an already-`object` JSON body before every field is optional-chained and re-parsed with Zod. If you prefer, replace them with a small Zod schema (`z.object({ error: z.object({ message: z.string().optional() }).optional() })`) — either is acceptable; choose one and say which in the commit body.

- [ ] **Step 2: Gates and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm format
git add src/components/intake/ src/components/orders/priority-badge.tsx
git commit -q -F - <<'EOF'
Add the intake panel with sample reports and result feedback

Submitting shows progress, the created tickets, or the API's own error
message with a retry; the five sample reports are one click away.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: Work-order list — badges, status control, filters, table and cards

**Files:**
- Create: `src/lib/dashboard/labels.ts`, `src/components/orders/priority-badge.tsx` (if not already), `type-icon.tsx`, `unit-chip.tsx`, `status-control.tsx`, `filter-tabs.tsx`, `work-order-row.tsx`, `work-order-card.tsx`, `work-order-list.tsx`

**Interfaces:**
- `labels.ts`: `PRIORITY_TONE: Record<Priority, BadgeTone>`, `STATUS_LABEL: Record<Status, string>`, `SOURCE_LABEL: Record<Source, string>`, `prioritySourceLabel(source: PrioritySource): string` ("Model" | "Rule: gas odor" | "Manual review").
- `PriorityBadge({ priority })`, `TypeIcon({ type })` (Phosphor icon per issue type, `aria-hidden`), `UnitChip({ unit })` (mono text, or amber "Unit unknown" badge).
- `StatusControl({ order, onChange(id, status): Promise<void> })` — Radix RadioGroup rendered as a 3-segment control; optimistic: calls `onChange`, which the parent implements by dispatching `setStatus`, PATCHing, and reverting on failure; shows an inline error text under the control when the parent rejects.
- `FilterTabs({ value, counts, onChange, children })` — Radix Tabs: the list of triggers plus one `Tabs.Content` (`value={value}`, `forceMount`) wrapping `children`, so each trigger's `aria-controls` resolves to the list below.
- `WorkOrderList({ orders, recentIds, filter, onStatusChange, onOpen(id) })` — desktop table (`<table>` with proper `<th scope="col">`), mobile cards (`md:hidden` / `hidden md:table`), empty state.

- [ ] **Step 1: Labels and small badges**

`src/lib/dashboard/labels.ts`:

```ts
import type { BadgeTone } from "@/components/ui/badge";
import type { Priority, Source, Status } from "@/lib/triage/schema";
import type { PrioritySource } from "@/lib/triage/types";

export const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  Emergency: "emergency",
  High: "ink",
  Medium: "outline",
  Low: "muted",
};

export const STATUS_LABEL: Record<Status, string> = {
  New: "New",
  "In Progress": "In progress",
  Done: "Done",
};

export const SOURCE_LABEL: Record<Source, string> = {
  text: "Typed report",
  phone: "Phone call",
  web_call: "Browser call",
};

export function prioritySourceLabel(source: PrioritySource): string {
  if (source === "model") return "Model";
  if (source === "fallback") return "Manual review";
  return `Rule: ${source.slice("rule:".length).replace(/_/g, " ")}`;
}
```

`src/components/orders/priority-badge.tsx`:

```tsx
import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_TONE } from "@/lib/dashboard/labels";
import type { Priority } from "@/lib/triage/schema";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority]}>
      {priority === "Emergency" && <WarningIcon size={14} weight="bold" aria-hidden />}
      {priority === "Low" && <span aria-hidden className="inline-block size-1.5 rounded-full bg-ink-muted" />}
      {priority}
    </Badge>
  );
}
```

(`@phosphor-icons/react/dist/ssr` exports server-safe icons; if the `Icon` suffix names do not exist in 2.1.10, use the unsuffixed names, e.g. `Warning`.)

`src/components/orders/type-icon.tsx`:

```tsx
import {
  BugIcon,
  DropIcon,
  FireIcon,
  HouseIcon,
  LightningIcon,
  PlugIcon,
  QuestionIcon,
  ThermometerIcon,
  type Icon,
} from "@phosphor-icons/react/dist/ssr";
import type { IssueType } from "@/lib/triage/schema";

const ICON: Record<IssueType, Icon> = {
  Plumbing: DropIcon,
  Electrical: LightningIcon,
  HVAC: ThermometerIcon,
  Appliance: PlugIcon,
  Gas: FireIcon,
  Structural: HouseIcon,
  Pest: BugIcon,
  Other: QuestionIcon,
};

export function TypeIcon({ type }: { type: IssueType }) {
  const Component = ICON[type];
  return <Component size={20} aria-hidden className="shrink-0 text-ink-muted" />;
}
```

`src/components/orders/unit-chip.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

export function UnitChip({ unit }: { unit: string | null }) {
  if (unit === null) return <Badge tone="followup">Unit unknown</Badge>;
  return <span className="font-mono text-[15px]">{unit}</span>;
}
```

- [ ] **Step 2: Status control and filter tabs**

`src/components/orders/status-control.tsx`:

```tsx
"use client";

import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { clsx } from "clsx";
import type { WorkOrderRow } from "@/lib/db/types";
import { STATUS_LABEL } from "@/lib/dashboard/labels";
import { STATUSES, type Status } from "@/lib/triage/schema";

export function StatusControl({
  order,
  onChange,
}: {
  order: WorkOrderRow;
  onChange: (id: string, status: Status) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function change(value: string) {
    const status = STATUSES.find((s) => s === value);
    if (!status || status === order.status) return;
    setError(null);
    setPending(true);
    try {
      await onChange(order.id, status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <RadioGroup.Root
        value={order.status}
        onValueChange={change}
        disabled={pending}
        aria-label={`Status for ${order.issue_type} ticket${order.unit ? ` in ${order.unit}` : ""}`}
        className="inline-flex rounded border border-line bg-surface p-0.5"
      >
        {STATUSES.map((status) => (
          <RadioGroup.Item
            key={status}
            value={status}
            className={clsx(
              "h-7 cursor-pointer rounded px-2.5 text-xs font-medium transition-colors disabled:cursor-wait",
              status === order.status
                ? status === "Done"
                  ? "bg-done-bg text-done"
                  : "bg-ink text-white"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {STATUS_LABEL[status]}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {error && (
        <p role="alert" className="mt-1 text-xs text-emergency">
          {error}
        </p>
      )}
    </div>
  );
}
```

`src/components/orders/filter-tabs.tsx`:

```tsx
"use client";

import { Tabs } from "radix-ui";
import { clsx } from "clsx";
import { FILTERS, type FilterKey } from "@/lib/dashboard/filters";

export function FilterTabs({
  value,
  counts,
  onChange,
}: {
  value: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (key: FilterKey) => void;
}) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(FILTERS.find((f) => f.key === next)?.key ?? "all")}>
      <Tabs.List aria-label="Filter work orders" className="flex flex-wrap gap-1 border-b border-line">
        {FILTERS.map((filter) => (
          <Tabs.Trigger
            key={filter.key}
            value={filter.key}
            className={clsx(
              "-mb-px flex h-10 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
              value === filter.key
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {filter.label}
            <span className="rounded bg-bg px-1.5 font-mono text-xs text-ink-muted">{counts[filter.key]}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
```

- [ ] **Step 3: Row, card and list**

`src/components/orders/work-order-row.tsx`:

```tsx
"use client";

import { clsx } from "clsx";
import type { WorkOrderRow } from "@/lib/db/types";
import { relativeTime } from "@/lib/dashboard/time";
import type { Status } from "@/lib/triage/schema";
import { PriorityBadge } from "./priority-badge";
import { StatusControl } from "./status-control";
import { TypeIcon } from "./type-icon";
import { UnitChip } from "./unit-chip";

export function WorkOrderTableRow({
  order,
  recent,
  siblingCount,
  now,
  onStatusChange,
  onOpen,
}: {
  order: WorkOrderRow;
  recent: boolean;
  siblingCount: number;
  now: Date;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  return (
    <tr
      className={clsx(
        "border-b border-line bg-surface align-top",
        order.needs_followup && "border-l-[3px] border-l-followup-line",
        recent && "row-arrive",
      )}
    >
      <td className="px-3 py-3">
        <PriorityBadge priority={order.priority} />
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-2">
          <TypeIcon type={order.issue_type} />
          {order.issue_type}
        </span>
      </td>
      <td className="px-3 py-3">
        <UnitChip unit={order.unit} />
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => onOpen(order.id)}
          className="cursor-pointer text-left hover:text-accent hover:underline"
        >
          {order.summary}
        </button>
        {siblingCount > 1 && (
          <span className="mt-1 block text-xs text-ink-muted">
            {order.position + 1} of {siblingCount} from this report
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <StatusControl order={order} onChange={onStatusChange} />
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm text-ink-muted tabular-nums whitespace-nowrap">
        <time dateTime={order.created_at}>{relativeTime(order.created_at, now)}</time>
      </td>
    </tr>
  );
}
```

`src/components/orders/work-order-card.tsx`:

```tsx
"use client";

import { clsx } from "clsx";
import type { WorkOrderRow } from "@/lib/db/types";
import { relativeTime } from "@/lib/dashboard/time";
import type { Status } from "@/lib/triage/schema";
import { PriorityBadge } from "./priority-badge";
import { StatusControl } from "./status-control";
import { TypeIcon } from "./type-icon";
import { UnitChip } from "./unit-chip";

export function WorkOrderCard({
  order,
  recent,
  now,
  onStatusChange,
  onOpen,
}: {
  order: WorkOrderRow;
  recent: boolean;
  now: Date;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  return (
    <li
      className={clsx(
        "rounded border border-line bg-surface p-4",
        order.needs_followup && "border-l-[3px] border-l-followup-line",
        recent && "row-arrive",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <PriorityBadge priority={order.priority} />
        <time dateTime={order.created_at} className="font-mono text-xs text-ink-muted">
          {relativeTime(order.created_at, now)}
        </time>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <TypeIcon type={order.issue_type} />
        <span>{order.issue_type}</span>
        <span aria-hidden>·</span>
        <UnitChip unit={order.unit} />
      </div>
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="mt-2 block min-h-11 cursor-pointer text-left text-[15px] hover:text-accent"
      >
        {order.summary}
      </button>
      <div className="mt-3">
        <StatusControl order={order} onChange={onStatusChange} />
      </div>
    </li>
  );
}
```

`src/components/orders/work-order-list.tsx`:

```tsx
"use client";

import type { WorkOrderRow } from "@/lib/db/types";
import { matchesFilter, type FilterKey } from "@/lib/dashboard/filters";
import type { Status } from "@/lib/triage/schema";
import { WorkOrderCard } from "./work-order-card";
import { WorkOrderTableRow } from "./work-order-row";

const HEADERS = ["Priority", "Type", "Unit", "Summary", "Status", "Age"] as const;

export function WorkOrderList({
  orders,
  recentIds,
  filter,
  now,
  onStatusChange,
  onOpen,
}: {
  orders: WorkOrderRow[];
  recentIds: string[];
  filter: FilterKey;
  now: Date;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const visible = orders.filter((order) => matchesFilter(order, filter));
  const siblingCounts = new Map<string, number>();
  for (const order of orders) siblingCounts.set(order.report_id, (siblingCounts.get(order.report_id) ?? 0) + 1);

  if (visible.length === 0) {
    return (
      <p className="rounded border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-muted">
        {orders.length === 0 ? "No work orders yet. Try a sample report." : "Nothing matches this filter."}
      </p>
    );
  }

  return (
    <>
      <table className="hidden w-full border-collapse text-[15px] md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className={header === "Age" ? "px-3 py-2 text-right" : "px-3 py-2"}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((order) => (
            <WorkOrderTableRow
              key={order.id}
              order={order}
              recent={recentIds.includes(order.id)}
              siblingCount={siblingCounts.get(order.report_id) ?? 1}
              now={now}
              onStatusChange={onStatusChange}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
      <ul className="space-y-3 md:hidden">
        {visible.map((order) => (
          <WorkOrderCard
            key={order.id}
            order={order}
            recent={recentIds.includes(order.id)}
            now={now}
            onStatusChange={onStatusChange}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 4: Gates and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm format
git add src/lib/dashboard/labels.ts src/components/orders/
git commit -q -F - <<'EOF'
Render work orders as a sortable table with live status control

Emergency first, amber edge for follow-ups, a three-way status control
per row, and cards instead of a table below tablet width.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: Detail drawer

**Files:**
- Create: `src/components/orders/order-drawer.tsx`, `src/components/orders/drawer-sections.tsx`

**Interfaces:**
- `OrderDrawer({ order: WorkOrderRow | null, allOrders, onClose })` — Radix `Dialog` as a right-hand sheet (`fixed inset-y-0 right-0 w-full max-w-xl`), focus-trapped, Esc closes, 200 ms in / 140 ms out. Loads `fetchReportBundle(getBrowserClient(), order.report_id)` when opened; shows a skeleton while loading and an inline error with Retry on failure.
- `drawer-sections.tsx`: `ReportText({ text, quote })` (highlights `quoteRange` with `<mark>`), `PriorityExplanation({ order, report })`, `MissingInfo({ order })`, `Siblings({ siblings, currentId })`, `AuditTrail({ report })`, `RawOutput({ report })` (`<details>` with `<pre>` JSON).

- [ ] **Step 1: Sections**

`src/components/orders/drawer-sections.tsx`:

```tsx
import type { ReportRow, WorkOrderRow } from "@/lib/db/types";
import { quoteRange } from "@/lib/dashboard/highlight";
import { prioritySourceLabel, SOURCE_LABEL } from "@/lib/dashboard/labels";
import { PriorityBadge } from "./priority-badge";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}

export function ReportText({ text, quote }: { text: string; quote: string | null }) {
  const range = quoteRange(text, quote);
  if (!range) return <p className="whitespace-pre-wrap">{text}</p>;
  return (
    <p className="whitespace-pre-wrap">
      {text.slice(0, range.start)}
      <mark className="rounded-sm bg-accent/15 px-0.5 text-ink">{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </p>
  );
}

export function PriorityExplanation({ order, report }: { order: WorkOrderRow; report: ReportRow }) {
  const escalated = order.model_priority !== null && order.model_priority !== order.priority;
  return (
    <dl className="space-y-2">
      <div className="flex items-center gap-2">
        <dt className="w-28 text-ink-muted">Assessed</dt>
        <dd className="flex items-center gap-2">
          <PriorityBadge priority={order.priority} />
          <span className="text-ink-muted">{prioritySourceLabel(order.priority_source)}</span>
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-28 shrink-0 text-ink-muted">Why</dt>
        <dd>{order.priority_reason}</dd>
      </div>
      {escalated && order.model_rationale && (
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-muted">Model said</dt>
          <dd>
            {order.model_priority}: {order.model_rationale}
          </dd>
        </div>
      )}
      {report.caller_stated_urgency && report.caller_stated_urgency !== "none_stated" && (
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-muted">Caller said</dt>
          <dd>
            {report.caller_urgency_quote ? <q>{report.caller_urgency_quote}</q> : report.caller_stated_urgency}
          </dd>
        </div>
      )}
    </dl>
  );
}

export function MissingInfo({ order }: { order: WorkOrderRow }) {
  if (order.missing_fields.length === 0 && order.grounding_notes.length === 0) return null;
  const labels: Record<string, string> = {
    unit_number: "Unit number not given — follow up with the caller.",
    issue_detail: "Problem too vague to dispatch — follow up with the caller.",
    unit_not_in_report: "The model suggested a unit the report never mentions; it was discarded.",
    quote_not_in_report: "The model's quote was not verbatim; the whole report was used instead.",
  };
  return (
    <ul className="list-disc space-y-1 pl-5">
      {[...order.missing_fields, ...order.grounding_notes].map((key) => (
        <li key={key}>{labels[key] ?? key}</li>
      ))}
    </ul>
  );
}

export function Siblings({ siblings, currentId }: { siblings: WorkOrderRow[]; currentId: string }) {
  const others = siblings.filter((row) => row.id !== currentId);
  if (others.length === 0) return <p className="text-ink-muted">This is the only ticket from this report.</p>;
  return (
    <ul className="space-y-1.5">
      {others.map((row) => (
        <li key={row.id} className="flex items-center gap-2">
          <PriorityBadge priority={row.priority} />
          <span>{row.issue_type}</span>
          <span className="text-ink-muted">— {row.summary}</span>
        </li>
      ))}
    </ul>
  );
}

export function AuditTrail({ report }: { report: ReportRow }) {
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-y-1 font-mono text-xs text-ink-muted">
      <dt>Source</dt>
      <dd>
        {SOURCE_LABEL[report.source]}
        {report.caller_last4 ? ` · caller …${report.caller_last4}` : ""}
      </dd>
      <dt>Model</dt>
      <dd>{report.model ?? "—"}</dd>
      <dt>Prompt</dt>
      <dd>{report.prompt_version}</dd>
      <dt>Latency</dt>
      <dd>{report.latency_ms === null ? "—" : `${(report.latency_ms / 1000).toFixed(1)} s`}</dd>
      <dt>Extraction</dt>
      <dd>{report.extraction_status === "ok" ? "ok" : `fallback — ${report.error ?? "unknown error"}`}</dd>
    </dl>
  );
}

export function RawOutput({ report }: { report: ReportRow }) {
  if (!report.llm_output) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-accent">Show the model's raw output</summary>
      <pre className="mt-2 max-h-72 overflow-auto rounded border border-line bg-bg p-3 font-mono text-xs leading-5">
        {JSON.stringify(report.llm_output, null, 2)}
      </pre>
    </details>
  );
}
```

(Import `type { ReactNode }` from react and use it in `Section` instead of `React.ReactNode`.)

- [ ] **Step 2: Drawer**

`src/components/orders/order-drawer.tsx`:

```tsx
"use client";

import { WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/db/browser-client";
import { fetchReportBundle } from "@/lib/db/public-reads";
import type { ReportRow, WorkOrderRow } from "@/lib/db/types";
import { AuditTrail, MissingInfo, PriorityExplanation, RawOutput, ReportText, Section, Siblings } from "./drawer-sections";
import { PriorityBadge } from "./priority-badge";
import { UnitChip } from "./unit-chip";

type Bundle =
  | { kind: "loading" }
  | { kind: "ready"; report: ReportRow; siblings: WorkOrderRow[] }
  | { kind: "error"; message: string };

export function OrderDrawer({ order, onClose }: { order: WorkOrderRow | null; onClose: () => void }) {
  const [bundle, setBundle] = useState<Bundle>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const reportId = order?.report_id ?? null;

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    setBundle({ kind: "loading" });
    fetchReportBundle(getBrowserClient(), reportId)
      .then((result) => {
        if (cancelled) return;
        setBundle(result ? { kind: "ready", ...result } : { kind: "error", message: "This report no longer exists." });
      })
      .catch((error: unknown) => {
        if (!cancelled) setBundle({ kind: "error", message: error instanceof Error ? error.message : "Could not load." });
      });
    return () => {
      cancelled = true;
    };
  }, [reportId, attempt]);

  return (
    <Dialog.Root open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/30 data-[state=open]:animate-[fade-in_200ms_ease-out] data-[state=closed]:animate-[fade-out_140ms_ease-in]" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-[0_0_0_1px_var(--color-line),-12px_0_32px_-16px_rgba(15,23,42,0.35)] data-[state=open]:animate-[slide-in_200ms_ease-out] data-[state=closed]:animate-[slide-out_140ms_ease-in]"
          aria-describedby={undefined}
        >
          {order && (
            <>
              <header className="flex items-start justify-between gap-4 border-b border-line p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={order.priority} />
                    <span className="text-sm text-ink-muted">{order.issue_type}</span>
                    <UnitChip unit={order.unit} />
                  </div>
                  <Dialog.Title className="mt-2 text-lg font-semibold leading-snug">{order.summary}</Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm" aria-label="Close">
                    <XIcon size={20} aria-hidden />
                  </Button>
                </Dialog.Close>
              </header>
              <div className="space-y-4 p-5">
                {bundle.kind === "loading" && (
                  <div aria-busy className="space-y-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-bg" />
                    <div className="h-4 w-full animate-pulse rounded bg-bg" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-bg" />
                  </div>
                )}
                {bundle.kind === "error" && (
                  <div role="alert" className="rounded border border-line bg-bg p-3 text-sm">
                    <p className="flex items-center gap-2">
                      <WarningCircleIcon size={18} aria-hidden className="shrink-0 text-ink-muted" />
                      {bundle.message}
                    </p>
                    <Button variant="secondary" size="sm" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>
                      Retry
                    </Button>
                  </div>
                )}
                {bundle.kind === "ready" && (
                  <>
                    <Section title="What the caller said">
                      <ReportText text={bundle.report.raw_text} quote={order.source_quote} />
                    </Section>
                    <Section title="Priority">
                      <PriorityExplanation order={order} report={bundle.report} />
                    </Section>
                    {(order.missing_fields.length > 0 || order.grounding_notes.length > 0) && (
                      <Section title="Follow-up and corrections">
                        <MissingInfo order={order} />
                      </Section>
                    )}
                    <Section title="Other tickets from this report">
                      <Siblings siblings={bundle.siblings} currentId={order.id} />
                    </Section>
                    <Section title="Audit trail">
                      <AuditTrail report={bundle.report} />
                      <div className="mt-3">
                        <RawOutput report={bundle.report} />
                      </div>
                    </Section>
                  </>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Add the keyframes to `src/app/globals.css`:

```css
@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes slide-in { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes slide-out { from { transform: none; opacity: 1 } to { transform: translateX(24px); opacity: 0 } }
```

- [ ] **Step 3: Gates and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm format
git add src/components/orders/order-drawer.tsx src/components/orders/drawer-sections.tsx src/app/globals.css
git commit -q -F - <<'EOF'
Explain each ticket in a drawer: quote, priority reasoning, audit trail

The original report is shown with the model's evidence highlighted,
the assessed priority next to what the model and the caller said, and
every correction the grounding step made.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: Page assembly, live indicator, route states

**Files:**
- Create: `src/components/dashboard.tsx`, `src/components/live-indicator.tsx`, `src/components/page-header.tsx`, `src/app/loading.tsx`, `src/app/error.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `page.tsx` (server): `export const dynamic = "force-dynamic"`; loads `listWorkOrders(createClient(url, publishableKey))` and renders `<Dashboard initialOrders={rows} />`.
- `Dashboard({ initialOrders, initialNow })` (client): owns `useWorkOrdersFeed`, filter state, open drawer id, a `now` clock seeded from the server's `initialNow` (hydration-safe) and ticking every 30 s; implements `onStatusChange` (dispatch `setStatus` → PATCH → revert and rethrow on failure) and `onCreated` (dispatch `upsert` with `fromRealtime: false` for each created order); renders header, two-column layout (`lg:grid-cols-[22rem_1fr]`), and an `aria-live` region whose text is cleared and re-set on every `state.announcement` (shape `{ seq, text } | null` after Task 3's reducer change) so repeated identical announcements are each read out.
- `LiveIndicator({ connection, lastEventAt })` — "● Live" / "Reconnecting…" / "Connecting…".

- [ ] **Step 1: Header and indicator**

`src/components/live-indicator.tsx`:

```tsx
"use client";

import { clsx } from "clsx";
import type { Connection } from "@/lib/dashboard/feed-reducer";

const LABEL: Record<Connection, string> = { connecting: "Connecting…", live: "Live", reconnecting: "Reconnecting…" };

export function LiveIndicator({ connection }: { connection: Connection }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted" role="status" aria-live="polite">
      <span
        aria-hidden
        className={clsx(
          "inline-block size-2 rounded-full",
          connection === "live" ? "bg-done" : connection === "reconnecting" ? "bg-followup-line" : "bg-ink-muted/50",
        )}
      />
      {LABEL[connection]}
    </span>
  );
}
```

`src/components/page-header.tsx`:

```tsx
import type { ReactNode } from "react";

export function PageHeader({ right }: { right: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 md:px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-base font-semibold tracking-tight">Workspark</h1>
        <span className="text-sm text-ink-muted">Maintenance work orders</span>
      </div>
      {right}
    </header>
  );
}
```

- [ ] **Step 2: Dashboard shell**

`src/components/dashboard.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { IntakePanel } from "@/components/intake/intake-panel";
import { FilterTabs } from "@/components/orders/filter-tabs";
import { OrderDrawer } from "@/components/orders/order-drawer";
import { WorkOrderList } from "@/components/orders/work-order-list";
import { LiveIndicator } from "@/components/live-indicator";
import { PageHeader } from "@/components/page-header";
import { useWorkOrdersFeed } from "@/hooks/use-work-orders-feed";
import type { WorkOrderRow } from "@/lib/db/types";
import { countFilters, type FilterKey } from "@/lib/dashboard/filters";
import type { Status } from "@/lib/triage/schema";

async function patchStatus(id: string, status: Status): Promise<void> {
  const response = await fetch(`/api/work-orders/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`Could not save the status (${response.status}).`);
}

export function Dashboard({ initialOrders, initialNow }: { initialOrders: WorkOrderRow[]; initialNow: string }) {
  const { state, dispatch } = useWorkOrdersFeed(initialOrders);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  // The server's clock seeds `now` so the first client render matches the HTML it hydrates.
  const [now, setNow] = useState(() => new Date(initialNow));
  const [liveText, setLiveText] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Clearing and re-setting the live region guarantees a DOM change per announcement, so two
  // tickets with identical text are both read out.
  useEffect(() => {
    if (!state.announcement) return;
    const { text } = state.announcement;
    setLiveText("");
    const timer = setTimeout(() => setLiveText(text), 50);
    return () => clearTimeout(timer);
  }, [state.announcement]);

  const counts = useMemo(() => countFilters(state.orders), [state.orders]);
  const openOrder = state.orders.find((order) => order.id === openId) ?? null;

  async function onStatusChange(id: string, status: Status) {
    const previous = state.orders.find((order) => order.id === id)?.status;
    dispatch({ type: "setStatus", id, status });
    try {
      await patchStatus(id, status);
    } catch (error) {
      if (previous) dispatch({ type: "setStatus", id, status: previous });
      throw error;
    }
  }

  function onCreated(orders: WorkOrderRow[]) {
    for (const row of orders) dispatch({ type: "upsert", row, fromRealtime: false });
  }

  return (
    <div className="min-h-dvh">
      <PageHeader right={<LiveIndicator connection={state.connection} />} />
      <main className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[22rem_1fr]">
        <IntakePanel onCreated={onCreated} />
        <section aria-labelledby="orders-heading" className="min-w-0">
          <h2 id="orders-heading" className="sr-only">
            Work orders
          </h2>
          <FilterTabs value={filter} counts={counts} onChange={setFilter}>
            <div className="mt-4">
              <WorkOrderList
                orders={state.orders}
                recentIds={state.recentIds}
                filter={filter}
                now={now}
                onStatusChange={onStatusChange}
                onOpen={setOpenId}
              />
            </div>
          </FilterTabs>
        </section>
      </main>
      <p className="sr-only" aria-live="polite">
        {liveText}
      </p>
      <OrderDrawer order={openOrder} onClose={() => setOpenId(null)} />
    </div>
  );
}
```

- [ ] **Step 3: Route files**

`src/app/page.tsx`:

```tsx
import { createClient } from "@supabase/supabase-js";
import { Dashboard } from "@/components/dashboard";
import { requireEnv } from "@/lib/env";
import { listWorkOrders } from "@/lib/db/public-reads";

export const dynamic = "force-dynamic";

export default async function Home() {
  const client = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const orders = await listWorkOrders(client);
  return <Dashboard initialOrders={orders} initialNow={new Date().toISOString()} />;
}
```

`src/app/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="min-h-dvh" aria-busy>
      <div className="h-14 border-b border-line bg-surface" />
      <div className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[22rem_1fr]">
        <div className="h-72 animate-pulse rounded border border-line bg-surface" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded border border-line bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

`src/app/error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">The dashboard could not load</h1>
      <p className="mt-2 text-sm text-ink-muted">
        The work orders could not be read from the database. Check the connection and try again.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
```

- [ ] **Step 4: Run it, gates, commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Open http://localhost:3000 (dev server). Expected: header with "Live" after a second; intake panel on the left; six seeded tickets on the right sorted Emergency → Low; "No heat" row has the amber edge and "Unit unknown".

```bash
pnpm format
git add src/components/dashboard.tsx src/components/live-indicator.tsx src/components/page-header.tsx src/app/page.tsx src/app/loading.tsx src/app/error.tsx
git commit -q -F - <<'EOF'
Assemble the dashboard page with live updates and route states

The server renders the current work orders; the client takes over,
subscribes to changes, and shows connection state, a loading skeleton
and a recoverable error page.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 8: Browser verification, screenshots, pull request

**Files:**
- Create: `docs/screenshots/dashboard.png`, `docs/screenshots/drawer.png`, `docs/screenshots/mobile.png`
- Modify: `CLAUDE.md` (tick Phase 3)

Load the `agent-browser` skill. Use the running dev server. Every observation below must be recorded in the report with what was actually seen.

- [ ] **Step 1: Click-through**

1. Open http://localhost:3000 at 1280×800. Observe: fonts are Fira Sans (not system), background `#F6F5F1`, six tickets, first two Emergency (red badges), "Live" indicator green.
2. Click the "7A maybe gas" chip → textarea fills; click **Submit report** → button reads "Reading report…"; within ~10 s a result card "Created 1 ticket · EMERGENCY Gas 7A" appears and a new row appears at the top with a brief highlight. (This makes one real model call and persists one row; delete it at the end.)
3. Open a second tab on the same URL. In tab 1 change the new ticket's status to **In progress**; in tab 2 the segment updates within ~1 s without reload.
4. Click the new ticket's summary → drawer opens; the quote is highlighted in the report text; Priority shows "EMERGENCY · Rule: gas odor" and the gas-odor reason; "Caller said" shows the hedging quote; Esc closes it and focus returns to the summary button.
5. Filter tabs: "Needs follow-up" shows only the HVAC ticket (count 1); "Done" shows "Nothing matches this filter."
6. Keyboard: Tab from the textarea reaches Submit, the chips, each row's summary button and the status segments; focus ring visible; Space/Arrow keys move the radio selection.
7. Resize to 375×812: cards replace the table, no horizontal scroll, status control still 44 px tall.
8. Stop the Supabase channel by going offline (DevTools → Network → Offline) for 5 s: indicator shows "Reconnecting…", then back to "Live" when online.

Capture `docs/screenshots/dashboard.png` (1280 wide, step 1 state with the new ticket), `drawer.png` (step 4), `mobile.png` (step 7).

Clean up the test ticket with the secret key (from `.env.local`, never echoed):

```bash
set -a; . ./.env.local; set +a
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/reports?raw_text=like.*maybe%20gas*&id=neq.<id-of-the-seeded-7A-report>" -H "apikey: $SUPABASE_SECRET_KEY"
```

(Find the seeded 7A report's id first with a GET on `reports?raw_text=like.*maybe%20gas*&select=id,created_at` and delete only the newer one.)

- [ ] **Step 2: Commit screenshots and status**

In `CLAUDE.md` tick `Phase 3 — dashboard UI, status updates` with the date.

```bash
git add docs/screenshots/ CLAUDE.md
git commit -q -F - <<'EOF'
Add dashboard screenshots and mark the UI phase done

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

- [ ] **Step 3: Pull request**

```bash
git push -u origin feat/dashboard
GH="$LOCALAPPDATA/Programs/gh/bin/gh.exe"
"$GH" pr create --base main --head feat/dashboard --title "Dashboard: intake, live work-order table, explanatory drawer" --body-file - <<'EOF'
## What
The property manager's screen: submit a report (typed or one of the five samples), watch tickets arrive live, filter them, change status, and open any ticket to see why it got its priority.

- Server-rendered initial list; the browser reads with the publishable key only (RLS: select) and follows `work_orders` changes over Supabase Realtime.
- Sort: Emergency → Low, newest first. Follow-up tickets get an amber edge and a "Unit unknown" tag.
- Status control is optimistic and reverts with an inline message if the PATCH fails.
- Drawer shows the original report with the model's quote highlighted, the assessed priority beside what the model and the caller said, grounding corrections, sibling tickets, and the audit trail.
- One visual system (warm paper, ink, one accent; red only on Emergency), Fira Sans / Fira Code, Radix primitives for the dialog, tabs and radio group.

## Why
End-to-end function is 30% of the grade and this is the part a reviewer sees. The drawer turns the extraction's audit trail into the walkthrough's evidence.

## How it was tested
- Vitest on the view model: sorting, filters and counts, relative time, quote highlighting, feed reducer, row parsing.
- Clicked through in a real browser (agent-browser): typed and sample submission, live update across two tabs, status change and revert path, drawer, keyboard navigation, 375 px layout, offline → reconnecting. Screenshots in `docs/screenshots/`.

![dashboard](docs/screenshots/dashboard.png)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
"$GH" pr checks --watch
```

Merge with `"$GH" pr merge --merge --delete-branch` once CI is green and Rafael has seen the preview URL Vercel posts on the PR.

---

## Self-review against spec §7

| Spec item | Task |
|---|---|
| Single page; intake left, table right; stacks < 768 px | 7, 5 |
| Header with live indicator incl. "Reconnecting…" | 7, 3 |
| Intake: labelled textarea + counter, Submit with progress, five sample chips, result card, inline error with retry | 4 |
| "Call intake" button with live call state | **Deferred to Plan 3** (needs the Vapi assistant) |
| Filter tabs with live counts | 5, 2 |
| Columns: badge, type icon, unit / "Unit unknown", summary with "n of m", source icon, status control, age | 5 — *source icon omitted from the table; the source is shown in the drawer's audit trail (recorded deviation; the column adds little until phone/web calls exist)* |
| Sort Emergency→Low, newest first | 2 |
| Follow-up rows amber edge | 5 |
| New rows highlight + aria-live announcement | 2, 3, 7 |
| Status control: segmented radio, optimistic, revert | 5, 7 |
| Drawer: report with quote highlight (by index), priority explanation, caller quote, missing info, grounding notes, siblings, transcript (shown as the report text for call sources), raw output, model/prompt/latency; Esc, focus trap | 6 |
| Empty, skeleton, error states | 5, 7 |
| Colour only for priority/status; red only Emergency; labels on badges | 1, 5 |
| Fira Sans / Fira Code via next/font; 4 px radius; one shadow (drawer) | 1, 6 |
| Phosphor icons, 20 px, one per type | 5 |
| Motion 200/140 ms; reduced-motion respected | 1, 6 |

Deviations recorded: Radix primitives instead of shadcn/ui (same accessibility primitives, no generated theme to override); no source icon column; Call intake button arrives with Plan 3.
