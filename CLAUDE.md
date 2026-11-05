# Workspark — AI-Powered Maintenance Ticketing Dashboard

Take-home test project for a hiring process. The brief is the Word file
`Mini Test Project - AI-Powered Maintenance Ticketing Dashboard.docx`, kept **local only** (gitignored,
never committed — decision 6). The original lives in Rafael's Google Drive folder "Workspark". If you
need the exact wording, unzip it and read `word/document.xml` (python stdlib `zipfile` works).

- Received 2026-11-05. **Due 2026-11-08** (72 hours after receipt).
- Expected effort 4–6 hours. Prototype quality, not production. Local run is enough; live deploy optional.
- Deliverables: public GitHub repo, README (env setup, install, run), walkthrough (written summary
  or Loom ≤ 5 min) showing results for **all five sample reports** below.

**Design spec (source of truth for the build): `docs/superpowers/specs/2026-11-05-maintenance-triage-design.md`.**
Long-form plan and reasoning: `docs/handoff/2026-11-05-build-plan.md`.
Rafael's machine setup checklist: `docs/handoff/SETUP-NEW-DESKTOP.md`.

## Status — keep this list current

- [x] Brief read, plan proposed (2026-11-05, on the previous desktop)
- [x] Open decisions below answered by Rafael (2026-11-05, new desktop)
- [x] Machine setup: CLIs installed, accounts authed, `.env.local` filled and every key verified (2026-11-05)
- [ ] Before submitting: rotate the keys Rafael pasted into chat (Anthropic, Vapi private, Supabase secret, DB password)
- [x] Design spec written to `docs/superpowers/specs/` and approved (2026-11-05)
- [ ] Plan 1 (triage core) written to `docs/superpowers/plans/` (2026-11-05; awaiting approval).
      Plans 2 (dashboard) and 3 (voice, docs) are written after Plan 1 lands.
- [ ] Phase 0 — repo, CI, env scaffolding, Supabase schema
- [ ] Phase 1 — extraction core (test-first) + eval over the 5 reports
- [ ] Phase 2 — API routes, persistence, realtime
- [ ] Phase 3 — dashboard UI, status updates
- [ ] Phase 4 — voice input
- [ ] Phase 5 — README, walkthrough, Loom script, screenshots, final review
- [ ] Submitted

## Decisions — answered by Rafael on 2026-11-05

1. **Stack.** Next.js (App Router) + TypeScript + Supabase Postgres + Vercel.
2. **Voice.** Vapi only, no separate speech-to-text provider. One Vapi assistant reachable two ways:
   a real inbound phone number, and a "Call intake" button on the dashboard using the Vapi Web SDK
   (so reviewers outside the US can try it). Both post the end-of-call report to
   `/api/webhooks/vapi` → same extraction pipeline. Cap call duration (~2 min) to limit spend.
   Rafael's Vapi org already has an assistant "Amy" — never modify it; create a new one.
   The org's existing public key is **unrestricted**. Before deploying, create a dedicated public
   key restricted to this project's assistant and to the Vercel domain + localhost, and use that
   for `NEXT_PUBLIC_VAPI_PUBLIC_KEY` in Vercel.
3. **GitHub.** Account **`Historfic`** (Rafael B. Bashan; there is no GitHub user "raffymcfee" —
   that is only the email). Public repo **`Historfic/workspark-maintenance`** — not yet created; get
   Rafael's explicit go-ahead before creating it or pushing. Commit identity
   `Rafael B. Bashan <raffymcfee@gmail.com>` (verified: GitHub links it to Historfic), set
   **repo-local** (this machine's global git config is empty and belongs to another Windows user —
   do not set it globally). Commits **keep** the `Co-Authored-By: Claude` trailer; the README says
   how AI was used. `Historfic/workspark` is the **private** hand-off repo from the old desktop; its
   history contains the brief `.docx`, so it must never be made public.
4. **Live deploy.** Yes, on Vercel (also required for the Vapi webhook).
5. **Model — Fable.** The app's extraction calls **`claude-fable-5-1`** at `effort: "low"`,
   overridable via `ANTHROPIC_MODEL`. Fable notes: thinking is always on (omit `thinking`), forced
   `tool_choice` returns 400 (use structured outputs), include server-side `fallbacks: "default"`,
   check `stop_reason == "refusal"`. The eval records latency per report; if Fable is too slow for a
   live demo, Rafael decides whether to switch the env default — do not switch on your own.
   **Implementation work is also done on Fable:** dispatch implementation subagents with
   `model: "fable"` (superpowers `subagent-driven-development`).
6. **Brief file.** Not committed. `*.docx` is gitignored; the README restates requirements in our
   own words.

## Workflow — non-negotiable

The **superpowers** plugin must be installed. Follow its skills in this order:
`brainstorming` (resume — the handoff plan is the output so far; do not restart from zero)
→ `writing-plans` → implement with `test-driven-development` → `code-review` + `security-review`
before each merge → `verification-before-completion` before claiming anything works.

- Do **not** scaffold or write application code until the spec and plan are approved by Rafael.
- Load `claude-api` before writing any Anthropic SDK code (structured outputs via
  `output_config.format` / `messages.parse()`, adaptive thinking, server-side `fallbacks`).
- Load `supabase` and `postgres-best-practices` for schema, migrations, RLS and client code.
- Load `ui-ux-pro-max` (and `frontend-design` if installed) before building the UI — Rafael wants
  the plugin UI skills used so the result doesn't look like AI slop. Load `agent-browser` to click
  through the running app and capture README screenshots.
- Keep `docs/handoff/` and `docs/superpowers/` in the repo. They are part of the story.

## What graders weigh

| Area | Weight |
|---|---|
| Working end to end (input → AI extraction → DB → dashboard → status updates) | 30% |
| AI extraction quality, including messy reports and missing information | 25% |
| Code quality, structure, security basics | 20% |
| README and walkthrough | 15% |
| Voice input bonus | 10% |

## The five sample reports and the outcomes we must produce

| # | Report (verbatim from the brief) | Required outcome |
|---|---|---|
| 1 | "Hi, this is apartment 4B. There is a major water leak coming from the ceiling in the bathroom and it's dripping onto the outlet!" | 1 ticket · Plumbing · **Emergency** (water contacting electrical) · unit 4B · no follow-up |
| 2 | "Hey, the heat isn't working in my place and it's freezing. Can someone come today?" | 1 ticket · HVAC · **High** · unit **null** · `needs_followup = true`, `missing_fields = ["unit_number"]`. Missing info must not lower priority |
| 3 | "Unit 12C here. The kitchen sink is clogged, and also the hallway light outside my door has been flickering for a week." | **2 tickets**, same report id, both unit 12C: Plumbing · Medium (clogged sink); Electrical · Low (Medium acceptable) (flickering light) |
| 4 | "Yeah hi, so um, I'm in 7A, and I don't know if it's a big deal, but there's kind of a weird smell near the stove, like maybe gas? My neighbor said it's probably nothing but I wanted to call anyway." | 1 ticket · Gas · **Emergency** regardless of the caller's hedging · unit 7A · `priority_reason` cites the gas-odor rule |
| 5 | "This is 2D. My bedroom window won't close all the way. Not urgent, whenever you get a chance." | 1 ticket · Structural · Low · unit 2D |

The walkthrough must also explain how the system handles missing information, multiple issues in
one report, and understated urgency. Reports 2, 3 and 4 are the evidence.

## Architecture summary (the design spec wins where they differ)

- **One Claude call per report** with structured outputs. Schema returns `issues[]` so one report can
  yield many tickets. `unit` is nullable; the prompt forbids guessing. Zod validates the output before
  any DB write. One retry with the validation error fed back; on a second failure, save the report
  and one `Other` ticket flagged for follow-up so nothing is silently lost.
- **Deterministic safety layer after the model.** Rules for gas odor, water contacting electrical,
  fire or smoke, flooding, no heat in cold weather. Rules may only **raise** priority. Each ticket
  stores `priority_source` (`model` or `rule:<name>`) and a human-readable `priority_reason`.
- **Enums.** `issue_type`: Plumbing | Electrical | HVAC | Appliance | Gas | Structural | Pest | Other.
  `priority`: Low | Medium | High | Emergency. `status`: New | In Progress | Done.
- **Tables.** `reports` (raw text, source `text|audio|phone`, transcript, llm raw output, model,
  prompt version, created_at) and `work_orders` (report_id FK, issue_type, priority, unit, location
  detail, summary, needs_followup, missing_fields, caller_stated_urgency, priority_source,
  priority_reason, status, timestamps).
- **Dashboard.** Intake panel (textarea, 5 sample-report chips, mic/upload) + work-order table
  (priority badge, type, unit or "Unit unknown" chip, summary, status control, relative time).
  Emergency sorts first. Filters by status and follow-up. Row drawer shows original report, sibling
  tickets, extracted JSON, priority reasoning, transcript. Supabase Realtime pushes new rows.
- **Voice.** Vapi assistant, two entry points: inbound phone number and in-browser web call
  (Vapi Web SDK). End-of-call-report webhook (verify shared secret) → same pipeline,
  `source = 'phone'` or `'web_call'`. Needs the Vercel URL. No audio upload, no separate STT.
- **Security.** Secrets only in env vars; `.env.example` with comments; service-role key
  server-side only; anon key limited by RLS to read; validate and sanitize LLM output before writing.
- **No auth.** Deliberate omission for the prototype; say so in README and an ADR.

## Engineering standards

**Commits.** 15–25 small commits that tell the build story. Imperative subject ≤ 72 chars, body
explains *why* when non-obvious. Never one giant commit, never "fix", "update", "wip", "changes".

**Branches and PRs.** One branch and one PR per phase (schema, extraction, dashboard, voice).
PR body: what, why, how it was tested, screenshot for UI. Merge with a merge commit so the small commits stay visible on `main`.

**CI.** GitHub Actions from the first PR: typecheck, lint, test on push and PR. Badge in README.

**Tests that mean something.** Unit tests on the escalation rules and Zod validators. A fixture-based
`pnpm eval` that runs the five reports through the real pipeline and writes results to
`docs/walkthrough.md`. One API-route test with the Anthropic client mocked. No snapshot spam, no
coverage targets, no tests of trivial getters.

**README.** ≤ 1000 words, engineer voice. Two-line pitch, Mermaid architecture diagram, setup in
≤ 5 steps, decisions and trade-offs, five-report results table, known limitations, what I'd do next.
No emoji headers, no feature-bullet walls, no "robust / seamless / powerful / comprehensive".

**Decision records.** `docs/decisions/` with 3–4 ADRs ≤ 150 words each: Postgres over SQLite,
structured outputs + rule layer, one report → many tickets, no auth.

**Code.** TypeScript strict, no `any`. Modules with one job; files under ~200 lines where practical.
No comments that narrate the code. No blanket try/catch. No unused shadcn components. One way to
do each thing. Delete dead code the moment it's dead.

**Design.** Not default shadcn gray. One deliberate type pairing. Semantic colour only for priority
and status (red reserved for Emergency). Real empty, loading and error states. No lorem ipsum.

**Secrets.** Never in the repo or in chat. `.env.local` is gitignored. Check `git diff` for keys
before every commit.

**Personal files.** Before staging, check that the folder holds only project files. Personal
documents must never be committed; if any appear in the root, stop and ask Rafael to move them.
`*.pdf` and `*.docx` are gitignored as a backstop.

## Planned environment variables

```
ANTHROPIC_API_KEY=              # required — extraction
ANTHROPIC_MODEL=                # optional — default claude-fable-5-1
NEXT_PUBLIC_SUPABASE_URL=              # required
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # required — sb_publishable_…, read-only via RLS, used for Realtime
SUPABASE_SECRET_KEY=                   # required — sb_secret_…, server only, never shipped to the browser
DATABASE_URL=                          # migrations only (session pooler connection string)
VAPI_PRIVATE_KEY=               # setup scripts only — creates/updates the assistant
NEXT_PUBLIC_VAPI_PUBLIC_KEY=    # browser web call (public by design; restrict origins in Vapi)
NEXT_PUBLIC_VAPI_ASSISTANT_ID=  # browser web call
NEXT_PUBLIC_VAPI_PHONE_NUMBER=  # shown on the dashboard
VAPI_WEBHOOK_SECRET=            # verifies end-of-call webhooks
RATE_LIMIT_SALT=                # hashes client IPs for the intake rate limit
```

## Setup state — this machine (Windows, PowerShell + Git Bash)

Supabase project for this app: `zjzcwgwaipzbednuakun`, region **ap-northeast-2 (Seoul)** — not East
US as planned; kept to avoid recreating it. Pin Vercel functions to **`icn1`** (Seoul) in
`vercel.json` so server code sits next to the database. This PC has no IPv6, so connect through the
session pooler `aws-0-ap-northeast-2.pooler.supabase.com:5432`, user `postgres.zjzcwgwaipzbednuakun`
(the direct `db.<ref>.supabase.co` host is IPv6-only). On Rafael's free plan. His other
active project ("raffymcfee@gmail.com's Project") holds unrelated business data — never touch it.
No Management API token for the new project; keys were copied from the dashboard. Uses the new key
types (publishable / secret), not legacy anon / service_role.

Node 24, npm 11, git and Python are present. `gh`, `vercel`, `pnpm` were missing on 2026-11-05.
Supabase CLI runs via `pnpm dlx supabase` / devDependency, not a global install. The workspace
path contains `ñ` (`C:\Users\Ivan Quiñola\...`) — if a tool chokes on it, suspect that first.

## Commands

`pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm format` ·
`pnpm eval` (five sample reports against the real model; `--persist` also saves them) ·
`pnpm db:migrate` (applies `supabase/migrations/*.sql` via `DATABASE_URL`).
