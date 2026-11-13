import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { DEMO_PROPERTIES, tenantsOf } from "@/lib/demo/rent-manager";
import { SAFETY_RULES } from "@/lib/triage/rules";
import type { RuleName } from "@/lib/triage/schema";

const RULE_TITLE: Record<RuleName, string> = {
  gas_odor: "Gas smell",
  water_electrical: "Water near electrical",
  fire_smoke: "Fire or smoke",
  flooding: "Flooding",
  no_heat_cold: "No heat in cold weather",
};

export function SafetyRulesPanel() {
  return (
    <section className="rounded border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-semibold">Emergency rules</h2>
      <p className="mt-0.5 text-sm text-ink-muted">
        Fixed rules run after the AI and can only raise a priority, never lower it. A tenant who
        plays it down is still escalated. They are always on; more rules can be added after review.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {SAFETY_RULES.map((rule) => (
          <li key={rule.name} className="flex items-start gap-3 py-2.5">
            <LockSimpleIcon size={18} aria-hidden className="mt-0.5 shrink-0 text-emergency" />
            <span>
              <span className="block text-sm font-medium">{RULE_TITLE[rule.name]}</span>
              <span className="block text-sm text-ink-muted">{rule.reason}</span>
            </span>
            <span className="ml-auto shrink-0 rounded bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">
              Always on
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PropertiesPanel() {
  return (
    <section className="rounded border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Properties</h2>
        <span className="rounded bg-followup-bg px-2 py-0.5 text-xs font-medium text-followup">
          Simulated Rent Manager
        </span>
      </div>
      <p className="mt-0.5 text-sm text-ink-muted">
        Read from Rent Manager, never edited here. The agent recognises tenants by their phone
        number or email.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {DEMO_PROPERTIES.map((property) => (
          <li key={property.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="font-medium">{property.name}</span>
            <span className="text-ink-muted">{property.address}</span>
            <span className="ml-auto font-mono text-xs text-ink-muted">
              {tenantsOf(property.id).length} tenants · {property.id}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
