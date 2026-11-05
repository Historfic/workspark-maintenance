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
const ELECTRICAL =
  /\b(outlets?|sockets?|electrical|electric|wiring|wires?|breakers?|panel|sparks?|sparking)\b/i;
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
  const fromModel: RuleOutcome = {
    priority: model.priority,
    source: "model",
    reason: model.rationale,
  };
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
