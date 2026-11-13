# Tenant line demo — implementation plan

Spec: `docs/superpowers/specs/2026-11-14-tenant-line-demo-design.md`. Branch `feat/tenant-line-demo`.
Test-first for every `lib/` module. One commit per task; `pnpm typecheck && pnpm lint && pnpm test`
green before each commit.

- [ ] 1. Rebrand to Solvv-Tunic; header tabs (Tickets, Settings); drop the displayed phone number.
- [ ] 2. `lib/demo/rent-manager.ts` + tests: demo tenants for the five sample units and more,
      `findTenant`, `rmTicketNumber`.
- [ ] 3. `lib/demo/settings.ts` + tests; `useDemoSettings` hook (localStorage); Settings page.
- [ ] 4. `lib/demo/escalation.ts`, `booking.ts`, `conversation.ts` + tests.
- [ ] 5. Ticket list and cards: tenant, RM ticket number, escalation badge.
- [ ] 6. Drawer: conversation, escalation timeline, booking sections with "Simulated" labels.
- [ ] 7. Retell browser call replaces Vapi (`retell-client-js-sdk`, public key + agent id).
- [ ] 8. Retell `call_ended` webhook + tests; delete Vapi server code, script and env vars.
- [ ] 9. README, `.env.example`, CLAUDE.md; final typecheck, lint, format, test, build.
- [ ] 10. Push branch, open PR (Rafael approves the push), check the Vercel preview.
