# Workspark maintenance triage

[![CI](https://github.com/Historfic/workspark-maintenance/actions/workflows/ci.yml/badge.svg)](https://github.com/Historfic/workspark-maintenance/actions/workflows/ci.yml)

Tenants describe a maintenance problem in their own words; Claude turns each report into one or more
structured work orders, code checks the result, and a live dashboard shows them by urgency.

**Live:** https://workspark-maintenance.vercel.app (no login: see [Decisions](#decisions-and-trade-offs)).

## Architecture

```mermaid
flowchart LR
  T[Typed report] --> API["POST /api/reports"]
  API --> N[Normalize]
  N --> X["Claude Fable 5.1<br/>structured output"]
  X --> G["Ground<br/>unit + quotes"]
  G --> R["Safety rules<br/>raise only"]
  R --> DB[("Supabase Postgres")]
  DB -- Realtime --> UI[Dashboard]
  UI -- "PATCH status" --> S["PATCH /api/work-orders/:id"]
  S --> DB
```

One model call per report. The model returns `issues[]`, so a report with two problems becomes two
tickets under the same report id. Zod validates the output before anything is written. On a second
failed attempt the report is still saved with one `Other` ticket flagged for manual review, and the
safety rules still run on it, so nothing is silently lost.

## Run it locally

Requires Node 24 and pnpm 12.

1. `pnpm install`
2. `cp .env.example .env.local` and fill in the Anthropic key, the Supabase URL and keys,
   `DATABASE_URL` (session pooler string) and a random `RATE_LIMIT_SALT`. Each variable is
   commented in `.env.example`.
3. `pnpm db:migrate` applies `supabase/migrations/*.sql`.
4. `pnpm dev` and open http://localhost:3000.
5. Optional: `pnpm seed:demo` runs 14 realistic reports through the real pipeline;
   `pnpm eval` runs the five sample reports from the brief and rewrites `docs/walkthrough.md`.

`pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm format:check` are what CI runs on every push
and pull request.

## How the hard cases are handled

- **Missing information (report 2).** `unit` is nullable and the prompt forbids guessing. Code
  enforces it: a unit survives only if it appears in the report and contains a digit, and every
  `source_quote` must be a verbatim substring. Anything that fails is dropped, the ticket is marked
  `needs_followup` with `missing_fields: ["unit_number"]`, and the dashboard shows an amber
  "Unit unknown" tag. Missing data never lowers priority.
- **Several problems in one report (report 3).** The schema is a list of issues, each with its own
  type, priority and quote, saved in one database transaction (`create_report_with_work_orders`).
  The drawer shows sibling tickets from the same report.
- **Understated urgency (report 4).** Priority follows the hazard, not the caller's tone. After the
  model, deterministic rules for gas odor, water near electrics, fire or smoke, flooding, and no
  heat in the cold can only raise priority. Each ticket stores `priority_source` (`model`,
  `rule:gas_odor`, …), a readable `priority_reason`, and the model's own priority beside it, so
  "why is this an emergency?" always has an answer.

## Results on the five sample reports

From `pnpm eval` against the real model (`claude-fable-5-1`, prompt `2026-11-05.3`):

| # | Report | Outcome | Decided by | Latency |
|---|---|---|---|---|
| 1 | 4B ceiling leak onto an outlet | Plumbing, **Emergency**, 4B | rule: water_electrical | 4.3 s |
| 2 | No heat, no unit given | HVAC, **High**, unit unknown, follow-up | rule: no_heat_cold | 2.6 s |
| 3 | 12C sink and hallway light | 2 tickets: Plumbing **Medium**, Electrical **Medium**, both 12C | model | 3.9 s |
| 4 | 7A "maybe gas", "probably nothing" | Gas, **Emergency**, 7A | rule: gas_odor | 3.1 s |
| 5 | 2D window, "not urgent" | Structural, **Low**, 2D | model | 2.8 s |

Full table and method: [docs/walkthrough.md](docs/walkthrough.md).

## Decisions and trade-offs

- **Structured outputs plus a rule layer.** The model handles language, which is the part code
  does badly; code handles the few cases where a miss is dangerous, which is the part a model can
  get wrong on a bad day. Rules favour false alarms over misses.
- **Postgres (Supabase) over SQLite.** Vercel functions have no persistent disk, and Realtime gives
  live updates for free. The browser gets a publishable key that RLS limits to reads; every write
  goes through a server route with the secret key.
- **No authentication.** A deliberate omission for a prototype: anyone with the URL can submit
  reports and change statuses. Mitigations are a per-IP rate limit (10 a minute, IPs hashed with a
  salt), request size caps and an Anthropic spend limit.
- **Fable at low effort** for extraction, overridable with `ANTHROPIC_MODEL`. Latency on the five
  reports was 2.6–4.3 s, fine for a synchronous request.
- **Functions in Seoul (`icn1`)** next to the database region, because every request makes several
  database round trips.

## Known limitations

- Rules match words, not meaning: "no gas smell" still raises a gas emergency, and water mentioned
  in the same sentence as a light fixture can over-escalate. "The radiators are cold" may not
  trigger the no-heat rule.
- A unit must contain a digit to survive grounding, so a transcript reading "seven A" would be
  dropped and flagged for follow-up.
- Report text is readable by anyone who has the dashboard URL.
- The rate limit trusts `x-forwarded-for`, which Vercel sets; elsewhere it could be spoofed.
- A client that retries after a lost response creates a duplicate report (no idempotency key).
- Borderline priorities (report 5 Low, report 3's light Medium) rest on model judgment and can
  move by one level between runs.
- Voice intake through Vapi (phone number and in-browser call) is being added now.

## What I'd do next

Sign-in with tenant and manager roles, and RLS scoped per property. Technician assignment and an
SMS alert on every Emergency. A larger eval set with negations and adversarial phrasing, run
nightly with a budget. An idempotency key on report submission.

## How AI was used

Built with Claude Code. Claude Opus coordinated; implementation tasks went to Claude Fable
subagents, and each task was reviewed by a separate model before it landed. The process followed a
written spec, per-phase plans and test-first development; all of it is in
[docs/superpowers](docs/superpowers) and [docs/handoff](docs/handoff). Commits carry a
`Co-Authored-By: Claude` trailer. I reviewed the plans, made the product decisions and checked the
running app.
