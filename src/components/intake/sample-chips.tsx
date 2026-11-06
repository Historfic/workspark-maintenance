"use client";

import { SAMPLE_REPORTS } from "@/lib/triage/samples";

export function SampleChips({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Sample reports">
      {SAMPLE_REPORTS.map((sample) => (
        <button
          key={sample.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(sample.text)}
          className="h-8 cursor-pointer rounded border border-line bg-surface px-3 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sample.label}
        </button>
      ))}
    </div>
  );
}
