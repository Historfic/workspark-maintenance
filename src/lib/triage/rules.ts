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
// Water on the move or sitting somewhere. Bare "water" counts, except in compounds that name
// a fixture ("water heater"), a dry trace ("water stain") or a utility ("water bill").
const WATER =
  /\b(leak\w*|drip\w*|flood\w*|pouring|gushing|spraying|seeping|soak\w*|puddl\w*|wet|splash\w*|water(?!\s+(heaters?|stains?|bills?|pressure|softeners?|filters?|meters?|bottles?|valves?|mains?)\b))\b/i;
// Electrical fixtures. "electric" naming an appliance ("electric water heater"), "light"
// describing a size ("a light drip") and "switch" as a verb are not fixtures.
const ELECTRICAL =
  /\b(outlets?|sockets?|wiring|wires?|breakers?|fuse box|sparks?|sparking|electric(al)?(?!\s+(water heater|heater|stove|oven|range|kettle|blanket|fireplace|bill))|lights?(?!\s+(leak|drip|trickl|flood|spray|mist|rain)\w*)|(lighting|ceiling) fixtures?|lamps?|(light|wall) switch(es)?|ceiling fans?)\b/i;
const FIRE =
  /\b(fire(?!\s+(extinguisher|drill|door|escape|code|safety|department))|flames?|burning smell|smells? (like )?burning|sparks?|sparking)\b/i;
const SMOKE = /\b(smoke|smoky)\b/i;
// Naming a smoke or fire alarm is not evidence of smoke or fire; the alarm sounding is.
// ALARM_DEVICE is global for String#replace only.
const ALARM_DEVICE = /\b(smoke|fire) (detector|alarm)s?\b/gi;
const ALARM_SOUNDING =
  /\b(smoke|fire) (detector|alarm)s?\b[^.!?]{0,40}?\b(going off|went off|goes off|sounding|triggered|activated|blaring)\b/i;
const FLOODING = /\b(flood(ed|ing)?|burst pipe|pipe (has )?burst|water (is )?(pouring|gushing))\b/i;
const HEAT_OUT =
  /\bno heat\b|\b(?<!water\s)(heat|heater|heating|furnace|boiler|radiators?)\b[^.!?]{0,30}?\b(not|isn['’]t|stopped|broken|broke|out|off|won['’]t|doesn['’]t|died|dead)\b/i;
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
    test: (text) => sentences(text).some((part) => WATER.test(part) && ELECTRICAL.test(part)),
  },
  {
    name: "fire_smoke",
    floor: "Emergency",
    reason: "Fire, smoke, or sparking reported.",
    test: (text) => {
      if (ALARM_SOUNDING.test(text)) return true;
      const report = text.replace(ALARM_DEVICE, "");
      return FIRE.test(report) || SMOKE.test(report);
    },
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

export function strongestRule(text: string): SafetyRule | null {
  const matched = matchRules(text);
  if (matched.length === 0) return null;
  return matched.reduce((best, rule) =>
    priorityRank(rule.floor) > priorityRank(best.floor) ? rule : best,
  );
}

export function applySafetyRules(
  model: { priority: Priority; rationale: string },
  text: string,
): RuleOutcome {
  const fromModel: RuleOutcome = {
    priority: model.priority,
    source: "model",
    reason: model.rationale,
  };
  const strongest = strongestRule(text);
  if (strongest === null || priorityRank(model.priority) > priorityRank(strongest.floor)) {
    return fromModel;
  }
  return {
    priority: higherPriority(model.priority, strongest.floor),
    source: `rule:${strongest.name}`,
    reason: strongest.reason,
  };
}
