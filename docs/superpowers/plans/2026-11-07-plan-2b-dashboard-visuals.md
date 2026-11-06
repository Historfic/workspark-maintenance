# Plan 2b — Dashboard visual pass

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Implementers run on `model: "fable"`. Load `ui-ux-pro-max` and `dataviz` before any UI work.

**Why:** Rafael reviewed the deployed dashboard on 2026-11-07: "it looks plain because it's all white and no visuals". He approved this pass (dark header, KPI tiles, two charts, a triage explainer, table fixes). It extends Plan 2 on the same branch `feat/dashboard`; Plan 2's Task 8 (browser check, screenshots, PR) runs after it.

**Decisions recorded here (supersede spec §7.2 where they differ):**
- A second elevation level is allowed: `shadow-card` on cards (the drawer keeps its own shadow).
- The header becomes a dark ink band with a logo mark.
- Charts: priority is ordinal, so priority colours form one slate ramp light→dark (Low `#94A3B8`, Medium `#475569`, High `#0F172A`) with Emergency `#B91C1C` as the critical status colour — identical to the badges. Validated with the dataviz validator: categorical checks do not apply (sequential ramp); Low is < 3:1 on white, so every segment carries a visible label/count (legend + direct labels). Intake chart: single series in `--color-accent`.
- No per-issue-type colours (Rafael chose the restrained option): type icons sit in neutral chips.
- Red still appears only for Emergency.

## Global Constraints

Plan 2's Global Constraints apply unchanged (exact versions, tokens, accessibility, no `any`/casts/non-null assertions in source, no narrating comments, files < ~200 lines, `pnpm format`, secret-scan before commits, explicit `git add`, Fable trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`). No new dependencies: charts are plain HTML/CSS (no chart library). Phosphor icon names must be verified against `node_modules/@phosphor-icons/react/dist/ssr/*.d.ts` (server components) or the package root (client components); substitute the nearest existing icon and say so if one is missing.

---

### Task V1: Header band, layout and table fixes, triage explainer, Task 7 review fixes

**Files:** `src/app/globals.css`, `src/components/page-header.tsx`, `src/components/live-indicator.tsx`, `src/components/dashboard.tsx`, `src/components/intake/intake-panel.tsx`, `src/components/intake/triage-explainer.tsx` (new), `src/components/orders/type-icon.tsx`, `src/components/orders/status-control.tsx`, `src/components/orders/work-order-list.tsx`, `src/components/orders/work-order-row.tsx`, `src/components/orders/order-drawer.tsx`, `src/app/error.tsx`, `src/app/loading.tsx`

1. **Task 7 review fixes (one commit first).**
   - `order-drawer.tsx`: during the exit animation the body flashes to the skeleton because `reportId`/`key` derive from the live `order`. Derive the displayed `reportId` and `key` from `shown` (the retained order) so the loaded bundle stays matched while closing; the fetch effect may stay keyed on `shown?.report_id` + `attempt` (it does not refetch for the same report). Screen readers must not hear "Loading report…" on close.
   - `error.tsx`: `reset()` alone does not re-run the server component that threw. Use `const router = useRouter(); startTransition(() => { router.refresh(); reset(); })` (`next/navigation`, `react`).
   - `loading.tsx`: replace bare `aria-busy` with `role="status"` + `<span className="sr-only">Loading work orders…</span>`.
   - Commit: `Stop the drawer flashing on close and make Retry refetch` (body: why; Fable trailer).
2. **Card elevation token.** In `@theme`: `--shadow-card: 0 1px 2px rgb(15 23 42 / 0.06), 0 2px 8px rgb(15 23 42 / 0.05);` → class `shadow-card`. Apply to the intake panel, the explainer, and a new white card that wraps the filter tabs + list (`rounded border border-line bg-surface shadow-card`).
3. **Header band** (`page-header.tsx`): `bg-ink text-white`, height 56 px, padding `px-4 md:px-6`. Left: a 32 px rounded (4 px) square `bg-accent` containing a white Phosphor `BuildingsIcon` (20 px, `aria-hidden`), then `Workspark` (`text-base font-semibold`) and `Maintenance work orders` (`text-sm text-white/70`, hidden below `sm`). Right: the live indicator. It stays the only `<h1>` ("Workspark").
4. **Live indicator on dark** (`live-indicator.tsx`): add a `tone?: "light" | "dark"` prop (default "light"); dark uses `text-white/80`; dot colours unchanged (`done` green live, `followup-line` amber reconnecting, `white/40` connecting). Drop the redundant `aria-live` (role="status" implies it).
5. **Intake panel header**: a 32 px neutral chip (`bg-bg border border-line rounded`) with Phosphor `ChatTextIcon` (`text-accent`) next to "New report", and a 3 px accent top border on the card (`border-t-[3px] border-t-accent`).
6. **Triage explainer** (`triage-explainer.tsx`, server component, rendered under the intake panel in the left column): heading "How triage works" (same style as "New report"), an ordered list of three steps, each a 32 px neutral icon chip + a bold line + one muted sentence:
   1. `BrainIcon` — **Claude reads the report** — "It splits the call into separate problems and quotes the caller's own words."
   2. `ShieldCheckIcon` — **Code checks the facts** — "A unit or quote the caller never said is dropped, and the ticket is flagged for follow-up."
   3. `SirenIcon` — **Safety rules set the floor** — "Gas, smoke, water near electrics and no heat in the cold are escalated, however calmly they're reported."
   Under the list, one muted line: "Every ticket's drawer shows which of these decided its priority."
7. **Type icon chip** (`type-icon.tsx`): wrap the icon in a 28 px neutral chip (`inline-flex size-7 items-center justify-center rounded bg-bg border border-line`), icon 16 px `text-ink-muted`.
8. **Table layout** (`work-order-list.tsx`, `work-order-row.tsx`, `status-control.tsx`):
   - `table-fixed` with a `<colgroup>`: Priority `8.5rem`, Type `9.5rem`, Unit `6.5rem`, Summary (auto), Status `17rem`, Age `6.5rem`.
   - Status segments `whitespace-nowrap` (the "In progress" label must never wrap); table size stays 28 px tall.
   - Summary button: `line-clamp-2` (full text remains the button's accessible name and is in the drawer).
   - Row vertical padding `py-3.5`; header row `bg-bg/60`.
   - Empty state: a 40 px neutral icon (`ClipboardTextIcon`, `text-ink-muted`) above the existing text.
9. Verify at 1440 px and 375 px against the running dev server (screenshots via `agent-browser`, wrap each call in `timeout 60`; avoid `wait --load networkidle`): no wrapped status labels, no horizontal scroll at 375 px, header contrast OK.
10. Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (skip build if `df -k /c` < 1 GB). Commit (explicit paths): `Give the dashboard a header band, card structure and a triage explainer` with a body explaining why (Rafael's review).

### Task V2: KPI tiles and charts (TDD for the data)

**Files:** `src/lib/dashboard/stats.ts` + `stats.test.ts` (new), `src/components/insights/kpi-tiles.tsx`, `priority-bar.tsx`, `intake-chart.tsx`, `chart-tooltip.tsx` (new), `src/components/dashboard.tsx`

**Interfaces**
- `openByPriority(rows: readonly WorkOrderRow[]): Array<{ priority: Priority; count: number }>` — non-Done tickets per priority, ordered Emergency → High → Medium → Low, zero counts included.
- `dailyIntake(rows: readonly WorkOrderRow[], now: Date, days = 7): Array<{ day: string; label: string; count: number }>` — one bucket per UTC calendar day ending with `now`'s day; `day` = `YYYY-MM-DD`, `label` = short weekday (`Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })`); counts work orders by `created_at`; rows outside the window ignored. UTC keeps server and client renders identical.
- `KpiTiles({ counts: Record<FilterKey, number>, active: FilterKey, onSelect(key: FilterKey): void })`
- `PriorityBar({ slices })`, `IntakeChart({ buckets })`

**Step 1 — tests first** (`src/lib/dashboard/stats.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { makeWorkOrderRow } from "@/test/fixtures";
import { dailyIntake, openByPriority } from "./stats";

describe("openByPriority", () => {
  it("counts open tickets per priority, Emergency first, zeros included, Done excluded", () => {
    const rows = [
      makeWorkOrderRow({ id: "a", priority: "Emergency" }),
      makeWorkOrderRow({ id: "b", priority: "Emergency", status: "Done" }),
      makeWorkOrderRow({ id: "c", priority: "Low", status: "In Progress" }),
      makeWorkOrderRow({ id: "d", priority: "Low" }),
    ];
    expect(openByPriority(rows)).toEqual([
      { priority: "Emergency", count: 1 },
      { priority: "High", count: 0 },
      { priority: "Medium", count: 0 },
      { priority: "Low", count: 2 },
    ]);
  });
});

describe("dailyIntake", () => {
  const now = new Date("2026-11-07T09:00:00.000Z");

  it("returns one bucket per day ending today, oldest first", () => {
    const buckets = dailyIntake([], now);
    expect(buckets.map((b) => b.day)).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07",
    ]);
    expect(buckets.at(-1)?.label).toBe("Sat");
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("counts tickets by UTC day and ignores those outside the window", () => {
    const rows = [
      makeWorkOrderRow({ id: "a", created_at: "2026-11-07T01:00:00.000Z" }),
      makeWorkOrderRow({ id: "b", created_at: "2026-11-06T23:59:59+00:00" }),
      makeWorkOrderRow({ id: "c", created_at: "2026-11-06T00:00:00.000Z" }),
      makeWorkOrderRow({ id: "d", created_at: "2026-10-20T12:00:00.000Z" }),
    ];
    const byDay = Object.fromEntries(dailyIntake(rows, now).map((b) => [b.day, b.count]));
    expect(byDay["2026-11-07"]).toBe(1);
    expect(byDay["2026-11-06"]).toBe(2);
    expect(Object.values(byDay).reduce((a, b) => a + b, 0)).toBe(3);
  });
});
```

Run `pnpm vitest run src/lib/dashboard/stats.test.ts` → FAIL (module missing).

**Step 2 — implement `stats.ts`:**

```ts
import type { WorkOrderRow } from "@/lib/db/types";
import { PRIORITIES, type Priority } from "@/lib/triage/schema";

const DAY_MS = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

export interface PrioritySlice {
  priority: Priority;
  count: number;
}

export interface DayBucket {
  day: string;
  label: string;
  count: number;
}

export function openByPriority(rows: readonly WorkOrderRow[]): PrioritySlice[] {
  const counts = new Map<Priority, number>();
  for (const row of rows) {
    if (row.status !== "Done") counts.set(row.priority, (counts.get(row.priority) ?? 0) + 1);
  }
  return [...PRIORITIES].reverse().map((priority) => ({ priority, count: counts.get(priority) ?? 0 }));
}

export function dailyIntake(rows: readonly WorkOrderRow[], now: Date, days = 7): DayBucket[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const buckets: DayBucket[] = Array.from({ length: days }, (_, index) => {
    const date = new Date(today - (days - 1 - index) * DAY_MS);
    return { day: date.toISOString().slice(0, 10), label: WEEKDAY.format(date), count: 0 };
  });
  const byDay = new Map(buckets.map((bucket) => [bucket.day, bucket]));
  for (const row of rows) {
    const time = Date.parse(row.created_at);
    if (Number.isNaN(time)) continue;
    const bucket = byDay.get(new Date(time).toISOString().slice(0, 10));
    if (bucket) bucket.count += 1;
  }
  return buckets;
}
```

Tests pass → commit `Compute open tickets by priority and daily intake` (explicit paths, Fable trailer).

**Step 3 — components (spec; write them to these rules):**
- **`KpiTiles`** (client): a `grid grid-cols-2 gap-3 md:grid-cols-4`; four tiles, each a `<button type="button" aria-pressed={active === key}>` card (`rounded border border-line bg-surface shadow-card p-4 text-left`, hover `border-accent`, pressed state `ring-2 ring-accent`). Order and content:
  1. key `emergency`, label "Emergency", Phosphor `WarningIcon` in a 36 px chip `bg-emergency/10 text-emergency` (the only red, and it is Emergency);
  2. key `followup`, label "Needs follow-up", `PhoneCallIcon`, chip `bg-followup-bg text-followup`;
  3. key `in_progress`, label "In progress", `WrenchIcon`, chip `bg-accent/10 text-accent`;
  4. key `done`, label "Resolved", `CheckCircleIcon`, chip `bg-done-bg text-done`.
  Number: `font-mono text-[28px] leading-none tabular-nums text-ink`; label `text-sm text-ink-muted`. Counts come from `countFilters` (same numbers as the tabs — consistent). Clicking sets the filter; clicking the active tile resets to "all".
- **`ChartTooltip`**: a small absolutely-positioned `bg-ink text-white text-xs rounded px-2 py-1 shadow-card` shown on hover/focus of a mark (`group-hover:block group-focus-visible:block`); marks are focusable (`tabIndex={0}`) with an `aria-label` carrying the same text.
- **`PriorityBar`**: card titled "Open tickets by priority" with the total (`font-mono`) on the right. A 14 px-tall bar: segments `flex` widths proportional to count (omit zero segments), 2 px surface gaps (`gap-0.5 bg-surface`), 4 px rounded outer ends only. Colours: Emergency `bg-emergency`, High `bg-ink`, Medium `bg-ink-muted`, Low `bg-[#94A3B8]` (add `--color-priority-low: #94a3b8` to `@theme` and use `bg-priority-low`). Hover tooltip "High · 3 open". Below: a legend row (swatch 10 px + label + count, text in ink tokens) for all four priorities including zeros. An sr-only sentence summarises ("5 emergency, 3 high, 7 medium and 3 low open tickets."). Empty (no open tickets): muted "No open tickets." instead of the bar.
- **`IntakeChart`**: card titled "Tickets received, last 7 days". Seven columns in a `grid grid-cols-7 items-end gap-2` over a 72 px plot; each bar `bg-accent` (60 % column width, centered), height `count / max * 100%` with a 3 px minimum stub for zero days drawn in `bg-line`; 4 px rounded top, flat base on a 1 px `border-line` baseline. Day labels (`text-xs text-ink-muted`) under each column; today's label `font-medium text-ink`. Direct count label above today's bar and the tallest bar only (selective labels). Hover/focus tooltip per bar: "Thu, Nov 6 · 4 tickets". sr-only sentence with the seven counts.
- **Dashboard layout** (`dashboard.tsx`): in the right column, above the list card: `KpiTiles`, then `grid gap-3 md:grid-cols-[1.4fr_1fr]` with `PriorityBar` and `IntakeChart`. Data via `useMemo` from `state.orders` and `now` (the server-seeded clock — hydration-safe).

**Step 4 — verify and commit.** Screenshots at 1440 and 375 px against the dev server; check no overflow, tooltips readable, numbers match the tabs. Gates (typecheck, lint, test, build). Commit (explicit paths): `Add KPI tiles and priority and intake charts to the dashboard` with a body explaining the colour decision.

### After V1 and V2

Run Plan 2's Task 8 with these updated expectations: the board shows the seeded data (21 tickets: 5 Emergency, 4 High, 8 Medium, 4 Low at seed time); KPI tiles and charts match the tab counts; screenshots `docs/screenshots/dashboard.png`, `drawer.png`, `mobile.png` include the new visuals.
