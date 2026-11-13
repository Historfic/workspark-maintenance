"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import type { ReportRow, WorkOrderRow } from "@/lib/db/types";
import { bookingPlan } from "@/lib/demo/booking";
import { agentReply, conversationLines } from "@/lib/demo/conversation";
import { escalationTimeline, type StepState } from "@/lib/demo/escalation";
import { findTenant, propertyOf, rmTicketNumber } from "@/lib/demo/rent-manager";
import type { DemoSettings } from "@/lib/demo/settings";
import { formatElapsed } from "@/lib/voice/call-state";
import { ReportText } from "./drawer-sections";

export function SimulatedTag() {
  return (
    <span className="ml-2 rounded bg-followup-bg px-1.5 py-0.5 align-middle text-[11px] font-medium tracking-normal text-followup normal-case">
      Simulated
    </span>
  );
}

export function TenantLine({ order }: { order: WorkOrderRow }) {
  const tenant = findTenant(order.unit);
  const property = tenant ? propertyOf(tenant) : undefined;
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-2 text-sm text-ink-muted">
      {tenant ? (
        <>
          <span className="text-ink">{tenant.name}</span>
          <span>· Unit {tenant.unit}</span>
          {property && <span>· {property.name}</span>}
          <span>· {tenant.phone}</span>
        </>
      ) : (
        <span>No tenant matched in Rent Manager; staff to confirm.</span>
      )}
      <span className="font-mono">· {rmTicketNumber(order.id)}</span>
    </p>
  );
}

export function Conversation({
  report,
  siblings,
  order,
}: {
  report: ReportRow;
  siblings: WorkOrderRow[];
  order: WorkOrderRow;
}) {
  const tenant = findTenant(order.unit);
  const reply =
    report.source === "text" ? agentReply(siblings, tenant?.name ?? null, rmTicketNumber) : null;
  const lines = conversationLines(report, reply);
  return (
    <ol className="space-y-2">
      {lines.map((line, index) => (
        <li
          key={index}
          className={clsx("flex flex-col", line.speaker === "agent" ? "items-end" : "items-start")}
        >
          <span className="mb-0.5 text-xs text-ink-muted">
            {line.speaker === "agent" ? "Agent" : (tenant?.name ?? "Tenant")}
            {line.simulated && <SimulatedTag />}
          </span>
          <div
            className={clsx(
              "max-w-[85%] rounded-lg px-3 py-2",
              line.speaker === "agent" ? "bg-accent/10" : "border border-line bg-bg",
            )}
          >
            {line.speaker === "tenant" ? (
              <ReportText text={line.text} quote={order.source_quote} />
            ) : (
              <p className="whitespace-pre-wrap">{line.text}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

const DOT: Record<StepState, string> = {
  done: "bg-done border-done",
  active: "bg-emergency border-emergency motion-safe:animate-pulse",
  scheduled: "bg-surface border-line",
};

function useTick(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

export function EscalationTimeline({
  order,
  settings,
}: {
  order: WorkOrderRow;
  settings: DemoSettings;
}) {
  const now = useTick(1000);
  const steps = escalationTimeline(order.created_at, settings, rmTicketNumber(order.id), now);
  return (
    <ol className="relative space-y-3 border-l border-line pl-5">
      {steps.map((step) => (
        <li key={step.key} className="relative">
          <span
            aria-hidden
            className={clsx(
              "absolute top-1 -left-[26.5px] size-3 rounded-full border-2",
              DOT[step.state],
            )}
          />
          <p className={clsx(step.state === "scheduled" ? "text-ink-muted" : "text-ink")}>
            {step.label}
          </p>
          <p className="font-mono text-xs text-ink-muted">
            {step.state === "scheduled"
              ? `in ${formatElapsed(step.at.getTime() - now.getTime())}`
              : step.at.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
            {" · "}
            {step.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function Booking({ order, settings }: { order: WorkOrderRow; settings: DemoSettings }) {
  const plan = bookingPlan(order.priority, order.created_at, settings.entryPolicy);
  return (
    <dl className="space-y-2">
      <div className="flex gap-2">
        <dt className="w-28 shrink-0 text-ink-muted">Visit</dt>
        <dd>
          <ul className="space-y-1">
            {plan.visits.map((visit) => (
              <li key={visit}>{visit}</li>
            ))}
          </ul>
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-28 shrink-0 text-ink-muted">Entry</dt>
        <dd>{plan.entry}</dd>
      </div>
    </dl>
  );
}
