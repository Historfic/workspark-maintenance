import type { DemoSettings } from "./settings";

export type StepState = "done" | "active" | "scheduled";
export type StepKey = "ticket" | "super" | "backup" | "answered";
export type EscalationStatus = "calling_super" | "calling_backup" | "answered";

export interface EscalationStep {
  key: StepKey;
  label: string;
  detail: string;
  at: Date;
  state: StepState;
}

type EscalationSettings = Pick<DemoSettings, "primary" | "backup" | "backupWaitMinutes">;

const SUPER_DELAY_MS = 20_000;
const ANSWER_DELAY_MS = 45_000;

function stepTimes(createdAt: string, settings: EscalationSettings): Record<StepKey, number> {
  const ticket = Date.parse(createdAt);
  const superCall = ticket + SUPER_DELAY_MS;
  const backup = superCall + settings.backupWaitMinutes * 60_000;
  return { ticket, super: superCall, backup, answered: backup + ANSWER_DELAY_MS };
}

const ORDER: readonly StepKey[] = ["ticket", "super", "backup", "answered"];

function latestReached(times: Record<StepKey, number>, now: Date): StepKey {
  return ORDER.filter((key) => times[key] <= now.getTime()).at(-1) ?? "ticket";
}

export function escalationTimeline(
  createdAt: string,
  settings: EscalationSettings,
  ticketNumber: string,
  now: Date,
): EscalationStep[] {
  const times = stepTimes(createdAt, settings);
  const latest = ORDER.indexOf(latestReached(times, now));
  const content: Record<StepKey, { label: string; detail: string }> = {
    ticket: {
      label: `Ticket ${ticketNumber} created in Rent Manager`,
      detail: "Written before anyone is called, so a failed call never loses the request.",
    },
    super: {
      label: `Calling and texting ${settings.primary.name}`,
      detail: settings.primary.phone,
    },
    backup: {
      label: `No answer after ${settings.backupWaitMinutes} min · calling ${settings.backup.name}`,
      detail: settings.backup.phone,
    },
    answered: {
      label: `${settings.backup.name} answered and is on the way`,
      detail: "The tenant gets a text with the arrival estimate.",
    },
  };
  return ORDER.map((key, index) => ({
    key,
    ...content[key],
    at: new Date(times[key]),
    state:
      index > latest ? "scheduled" : index === latest && key !== "answered" ? "active" : "done",
  }));
}

export function escalationStatus(
  createdAt: string,
  settings: EscalationSettings,
  now: Date,
): EscalationStatus {
  const latest = latestReached(stepTimes(createdAt, settings), now);
  if (latest === "answered") return "answered";
  return latest === "backup" ? "calling_backup" : "calling_super";
}
