# Build plan — AI-Powered Maintenance Ticketing Dashboard

Written 2026-11-05 after reading the brief. Status: **proposed, not yet approved.** Four decisions
are open (see `CLAUDE.md` → Open decisions). This document is the long-form reasoning behind the
summary in `CLAUDE.md`; when they disagree, `CLAUDE.md` wins because it is kept current.

## 1. What the brief asks for

A lightweight prototype: a caller's unstructured maintenance report goes in, an LLM extracts a
structured work order, it is saved to a database with a timestamp and status `New`, and a dashboard
shows all work orders with priority badges, follow-up highlighting and a status control
(New → In Progress → Done). Optional bonus: accept the report as audio or a real phone call.

Hard requirements the extraction must satisfy:

- Fields: issue type, priority/urgency, location/unit, summary.
- **Missing-information flag.** If the unit number is absent, flag for follow-up. Never guess.
- **Validate the AI output** against expected fields and values before saving.
- Handle **multiple issues in one report** and **understated urgency**.

Deliverables: public GitHub repo, README with env/install/run instructions, written walkthrough or
Loom ≤ 5 minutes covering architecture, extraction logic and the five sample results.

## 2. Stack decision

### Recommended: Next.js + TypeScript + Supabase Postgres + Vercel

- Single repo; API routes are the backend. One deploy target.
- Supabase Realtime gives the "real time" dashboard with a few lines of client code.
- Vercel gives a public URL for evaluators and a webhook target for the Vapi tier.
- These are the tools Rafael already uses.
- Cost to evaluators running locally: a free Supabase project (about two minutes) plus pasting
  three values into `.env.local`. The live URL covers anyone who skips that.

### Considered and rejected

- **Python/FastAPI + SQLite + Streamlit.** Fastest to write, zero accounts. But Streamlit reads as a
  generic prototype, has no live updates, and makes a deliberate visual design nearly impossible.
- **Next.js + local SQLite (Drizzle).** Zero external setup for evaluators. But no Vercel deploy
  without a hosted SQLite, no realtime, and no public webhook for the phone-call bonus.

## 3. Extraction design (the 25% that separates submissions)

### Pipeline

1. **Normalize input.** Trim, cap length, strip control characters. Reject empty.
2. **One Claude call** (`claude-opus-5-5`, adaptive thinking, `effort: "low"`, server-side
   `fallbacks: "default"`) using structured outputs with a Zod schema via `messages.parse()`.
   System prompt carries: the issue taxonomy, the priority rubric written in terms of hazard and
   consequence (not caller tone), the instruction to split distinct problems into separate issues,
   and the rule to leave `unit` null and list it in `missing_fields` rather than infer it.
3. **Validate.** Zod parse. On failure, retry once with the validation error appended. On a second
   failure, persist the report with one `Other` ticket, `needs_followup = true`,
   `priority_reason = "extraction failed; manual review"`. Nothing is silently dropped.
4. **Deterministic safety escalation.** Pure functions over report text + extracted fields.
   Rules can only raise priority:
   - gas / smell of gas / carbon monoxide → Emergency
   - water or leak + outlet / electrical / sparking → Emergency
   - fire / smoke / burning smell → Emergency
   - flooding / water pouring → Emergency
   - no heat + freezing / cold weather → High
   Each rule has a name; the ticket records `priority_source = "rule:<name>"` and a readable
   `priority_reason`. If no rule fires, `priority_source = "model"` and the reason is the model's
   own one-line rationale.
5. **Persist** one `reports` row and N `work_orders` rows. Store raw model output, model id and
   prompt version on the report for auditability.
6. **Realtime** push to the dashboard via Supabase channel on `work_orders`.

### Schema the model must return

```
{
  caller_stated_urgency: "low" | "medium" | "high" | "emergency" | "unstated",
  issues: [
    {
      issue_type: Plumbing | Electrical | HVAC | Appliance | Gas | Structural | Pest | Other,
      priority: Low | Medium | High | Emergency,
      priority_rationale: string,        // one line, hazard-based
      summary: string,                   // ≤ 160 chars, plain language
      location: { unit: string | null, area: string | null },
      missing_fields: string[],          // e.g. ["unit_number"]
    }
  ]
}
```

`needs_followup` is derived server-side: `missing_fields.length > 0`.

### Expected results for the five reports

| # | Tickets | Type | Priority | Unit | Flags |
|---|---|---|---|---|---|
| 1 | 1 | Plumbing | Emergency (rule: water + electrical) | 4B | — |
| 2 | 1 | HVAC | High (rule: no heat + freezing, or model) | null | needs_followup, missing unit_number |
| 3 | 2 | Plumbing / Electrical | Medium / Low | 12C, 12C | — |
| 4 | 1 | Gas | Emergency (rule: gas odor) | 7A | — |
| 5 | 1 | Structural | Low | 2D | — |

These become the fixture for `pnpm eval`, which runs the real pipeline and writes the results table
into `docs/walkthrough.md`. The eval asserts ticket count, type, priority ceiling/floor, unit and
follow-up flag; it does not assert exact summary wording.

## 4. Data model

```
reports
  id uuid pk, created_at timestamptz default now()
  source text check (source in ('text','audio','phone'))
  raw_text text not null
  transcript text                 -- for audio/phone
  audio_url text                  -- optional, if we keep the file
  llm_raw jsonb                   -- validated model output
  model text, prompt_version text
  extraction_status text check (... in ('ok','failed'))

work_orders
  id uuid pk, report_id uuid fk → reports on delete cascade
  issue_type text check (enum above)
  priority text check (enum above)
  unit text null, location_detail text null
  summary text not null
  needs_followup boolean not null default false
  missing_fields text[] not null default '{}'
  caller_stated_urgency text
  priority_source text not null   -- 'model' | 'rule:<name>'
  priority_reason text not null
  status text not null default 'New' check (status in ('New','In Progress','Done'))
  created_at, updated_at timestamptz
```

RLS: anon role may `select` on both tables (dashboard reads + Realtime). All writes go through
server code using the service-role key. Realtime enabled on `work_orders`.

## 5. API surface

- `POST /api/reports` — body `{ text }` → runs pipeline → `201 { report, work_orders }`.
- `POST /api/reports/audio` — multipart audio → STT → same pipeline (voice tier 1).
- `POST /api/webhooks/vapi` — verifies shared secret, extracts transcript from the
  end-of-call-report payload → same pipeline (voice tier 2).
- `PATCH /api/work-orders/:id` — body `{ status }` → validates enum → updates → `200`.
- `GET /api/work-orders` — list with optional `status` / `needs_followup` filters (dashboard
  initial load; subsequent updates arrive via Realtime).

All inputs validated with Zod. Errors return `{ error: { code, message } }` with correct status.

## 6. Dashboard

Single page.

- **Intake panel.** Textarea, submit, five one-click chips with the sample reports, mic button
  (MediaRecorder) and file upload. Shows a compact "what we extracted" card after submit.
- **Work-order table.** Columns: priority badge, issue type, unit (or amber "Unit unknown" chip),
  summary, status control (segmented New / In Progress / Done, optimistic update), relative time.
  Sort: Emergency first, then High, then newest. Filters: status tabs, "needs follow-up" toggle.
  Amber left border on follow-up rows.
- **Row drawer.** Original report text, sibling tickets from the same report, extracted JSON,
  priority reasoning (why it was escalated), transcript when source is audio/phone.
- **Realtime.** New rows appear with a brief highlight; status changes from another tab reflect.
- **Design.** Load `frontend-design`. One type pairing, restrained neutral palette, semantic colour
  only for priority and status, proper empty/loading/error states, keyboard-reachable controls.

## 7. Voice bonus

- **Tier 1 — ship this.** Browser recording and file upload → `POST /api/reports/audio` →
  server-side STT (provider chosen by Rafael: OpenAI, Deepgram or Groq; Deepgram and Groq have free
  tiers) → transcript saved on the report → same extraction pipeline. `source = 'audio'`.
- **Tier 2 — if Rafael wants it.** Vapi inbound assistant that takes the caller's report, then
  posts the end-of-call report to `/api/webhooks/vapi` on the Vercel deployment. Verify the shared
  secret header, pull the transcript, run the pipeline, `source = 'phone'`. Roughly one extra hour
  given Rafael's Vapi experience.

## 8. Phases and time budget

| Phase | Work | Estimate |
|---|---|---|
| 0 | pnpm + Next.js scaffold, strict TS, ESLint/Prettier, GitHub Actions, `.env.example`, Supabase migration, README skeleton | 45 min |
| 1 | Zod schemas, prompt, escalation rules (TDD), Anthropic client wrapper, `pnpm eval` fixture | 90 min |
| 2 | API routes, persistence, Realtime, route test with mocked client | 45 min |
| 3 | Dashboard UI, status control, drawer, filters, design pass | 2 h |
| 4 | Voice tier 1 (45 min); tier 2 Vapi (+60 min, optional) | 45–105 min |
| 5 | README, `docs/walkthrough.md`, ADRs, Loom script, screenshots via agent-browser, code + security review | 60 min |

Total: roughly 6.5–7.5 hours of focused work, inside the 72-hour window with margin.

## 9. What Rafael provides

| Item | Needed for | Notes |
|---|---|---|
| Anthropic API key | Extraction, eval | Into `.env.local` after scaffold. Never in chat. |
| Supabase project (URL, anon key, service-role key, connection string) | Database, Realtime | Free tier. Either authorize the Supabase connector in claude.ai so Claude can run migrations, or provide `DATABASE_URL`. |
| GitHub CLI logged in (`gh auth login`) | Repo creation, PRs | Or create an empty public repo and share the URL. |
| Vercel login or token | Live demo, Vapi webhook | Optional but recommended. |
| STT provider key | Voice tier 1 | OpenAI, Deepgram or Groq. |
| Vapi account + number | Voice tier 2 | Optional. |
| Loom recording | Walkthrough | Claude writes the script; Rafael records. |

## 10. Anti-slop practices

See `CLAUDE.md` → Engineering rules for the enforced list. The short version: small honest commits,
PRs with real descriptions, CI from the start, tests that catch real regressions, an engineer-voiced
README under 1000 words, three or four short decision records, strict TypeScript with no narrating
comments, and a UI with one deliberate design direction instead of framework defaults.

## 11. Open questions (answer in `CLAUDE.md`)

1. Stack: Next.js + Supabase + Vercel as above, or Python?
2. Voice scope and STT provider?
3. GitHub account, repo name, commit identity, co-author trailer yes/no?
4. Live Vercel deploy or local-only?
5. Model: keep `claude-opus-5-5` default or choose Sonnet 5.5 / Haiku 5.5 for cost?
