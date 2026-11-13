"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ENTRY_POLICIES, type DemoSettings, type EntryPolicy } from "@/lib/demo/settings";

const INPUT =
  "h-10 w-full rounded border border-line bg-surface px-3 text-[15px] focus:border-accent focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Card({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="rounded border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-muted">{lead}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({
  settings,
  onSave,
  onReset,
}: {
  settings: DemoSettings;
  onSave: (next: DemoSettings) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  function update(next: DemoSettings) {
    setDraft(next);
    setSaved(false);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
        setSaved(true);
      }}
    >
      <Card
        title="On-call and escalation"
        lead="Who the agent calls and texts for an emergency, and how long it waits before trying the backup."
      >
        <Field label="On-call super">
          <input
            className={INPUT}
            value={draft.primary.name}
            onChange={(e) =>
              update({ ...draft, primary: { ...draft.primary, name: e.target.value } })
            }
            required
          />
        </Field>
        <Field label="Super's phone">
          <input
            className={INPUT}
            inputMode="tel"
            value={draft.primary.phone}
            onChange={(e) =>
              update({ ...draft, primary: { ...draft.primary, phone: e.target.value } })
            }
          />
        </Field>
        <Field label="Backup">
          <input
            className={INPUT}
            value={draft.backup.name}
            onChange={(e) =>
              update({ ...draft, backup: { ...draft.backup, name: e.target.value } })
            }
            required
          />
        </Field>
        <Field label="Backup's phone">
          <input
            className={INPUT}
            inputMode="tel"
            value={draft.backup.phone}
            onChange={(e) =>
              update({ ...draft, backup: { ...draft.backup, phone: e.target.value } })
            }
          />
        </Field>
        <Field
          label="Backup wait (N)"
          hint="Minutes without an answer before the backup is called."
        >
          <input
            className={INPUT}
            type="number"
            min={1}
            max={30}
            value={draft.backupWaitMinutes}
            onChange={(e) =>
              update({
                ...draft,
                backupWaitMinutes: Math.min(30, Math.max(1, Number(e.target.value) || 1)),
              })
            }
          />
        </Field>
      </Card>

      <Card
        title="Office hours and entry"
        lead="Outside office hours only emergencies wake someone up. Entry rules decide what the agent asks before booking a visit."
      >
        <Field label="Office opens">
          <input
            className={INPUT}
            type="time"
            value={draft.officeHours.open}
            onChange={(e) =>
              update({ ...draft, officeHours: { ...draft.officeHours, open: e.target.value } })
            }
          />
        </Field>
        <Field label="Office closes">
          <input
            className={INPUT}
            type="time"
            value={draft.officeHours.close}
            onChange={(e) =>
              update({ ...draft, officeHours: { ...draft.officeHours, close: e.target.value } })
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Entry rule">
            <select
              className={INPUT}
              value={draft.entryPolicy}
              onChange={(e) => update({ ...draft, entryPolicy: e.target.value as EntryPolicy })}
            >
              {Object.entries(ENTRY_POLICIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!dirty}>
          Save settings
        </Button>
        <Button variant="secondary" onClick={onReset}>
          Reset to defaults
        </Button>
        <span role="status" className="text-sm text-ink-muted">
          {saved && !dirty ? "Saved in this browser." : ""}
        </span>
      </div>
    </form>
  );
}
