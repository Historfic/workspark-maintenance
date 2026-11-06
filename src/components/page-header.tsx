import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

export function PageHeader({ right }: { right: ReactNode }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 bg-ink px-4 text-white md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded bg-accent"
        >
          <BuildingsIcon size={20} weight="fill" />
        </span>
        <h1 className="text-base font-semibold tracking-tight">Workspark</h1>
        <span className="hidden truncate text-sm text-white/70 sm:inline">
          Maintenance work orders
        </span>
      </div>
      {right}
    </header>
  );
}
