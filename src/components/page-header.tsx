import type { ReactNode } from "react";

export function PageHeader({ right }: { right: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 md:px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-base font-semibold tracking-tight">Workspark</h1>
        <span className="text-sm text-ink-muted">Maintenance work orders</span>
      </div>
      {right}
    </header>
  );
}
