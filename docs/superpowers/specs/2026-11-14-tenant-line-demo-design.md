# Solvv-Tunic tenant line — UI demo on Workspark

- Date: 2026-11-14 · Status: approved by Rafael in chat on 2026-11-14
- Goal: turn the Workspark prototype into a clickable demo of the Solvv-Tunic AI tenant line admin,
  for Avraham's review on Monday 2026-11-16. Presentation-ready, not production.
- Source of truth for the product: Rafael's one-pager (AI Tenant Line, draft v1, 14 Nov 2026).

## Decisions

1. **Change Workspark itself.** Same repo and Vercel URL. Work happens on `feat/tenant-line-demo`; the
   live site changes only when Rafael merges the pull request.
2. **Real AI, simulated rest.** Typed reports still run through Claude and the safety rules and are
   saved to Supabase unchanged. Rent Manager, on-call call-outs and booking are simulated in code
   and labelled "Simulated" on screen. No database changes.
3. **Branding:** Solvv-Tunic.
4. **Voice:** Retell replaces Vapi. The browser call uses Retell's web SDK with a public key
   restricted to the site's domains. Retell's `call_ended` webhook runs the transcript through the
   same pipeline, so a call becomes tickets. Vapi code, scripts and env vars are deleted, including
   the displayed phone number.

## Screens

- **Header:** Solvv-Tunic, tabs Tickets and Settings, live indicator.
- **Tickets:** intake box (samples, Retell call button), KPIs and charts, ticket list. Each row adds
  tenant name and unit from the demo Rent Manager, a Rent Manager ticket number (`SI-####`), and for
  emergencies an escalation badge. Emergency still sorts first.
- **Ticket drawer:** conversation (tenant words as a thread; for typed reports a simulated agent
  reply), emergency escalation timeline, booking (visit options, entry permission), why this
  priority, other tickets from the report, audit trail and raw output.
- **Settings:** on-call primary and backup (name, phone), backup wait N minutes, office hours,
  entry policy, emergency rules (always on, read-only), properties (read-only). Stored in the
  browser's localStorage; defaults when absent or invalid.

## Units

| Module | Job |
|---|---|
| `lib/demo/rent-manager.ts` | Demo properties and tenants; `findTenant(unit)`; `rmTicketNumber(id)` (stable per ticket) |
| `lib/demo/settings.ts` | Settings type, defaults, `parseSettings(raw)` |
| `lib/demo/escalation.ts` | `escalationTimeline(createdAt, settings, now)` and the current status, emergencies only |
| `lib/demo/booking.ts` | Visit options by priority from a fixed super schedule; entry text from the policy |
| `lib/demo/conversation.ts` | Thread lines from a report; simulated agent reply for typed reports |
| `lib/retell/call-ended.ts` | Parse Retell's webhook body into transcript, source, caller last 4, call id |
| `lib/api/retell-webhook.ts` | Verify `x-retell-signature` with `retell-sdk`, then triage after the response |

Escalation script, relative to ticket creation: ticket created in Rent Manager → +20 s call and text
the on-call super → +N min no answer, call and text the backup → +45 s backup answered. Each step is
done, active or scheduled against the current time. Nothing is ever called or texted.

## Security and cost

The Retell public key is restricted to the production domain and localhost. Calls are capped at
5 minutes by the agent. The webhook rejects bad or missing signatures (401) and stores nothing.
The Retell API key stays server-side. Repeated webhooks are deduplicated by the existing unique
call id on `reports`.

## Testing

Unit tests for every `lib/demo` module, the Retell parser and the webhook handler (bad signature,
ignored events, transcript to triage). Existing tests stay green. Typecheck, lint, format.

## Out of scope

Real Rent Manager, Twilio, email, real call-outs, auth, saving settings to the database.
