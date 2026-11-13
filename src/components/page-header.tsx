import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { HeaderNav } from "./header-nav";

export function PageHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 bg-ink px-4 text-white md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded bg-accent"
        >
          <BuildingsIcon size={20} weight="fill" />
        </span>
        <h1 className="text-base font-semibold tracking-tight">Solvv-Tunic</h1>
        <span className="hidden truncate text-sm text-white/70 lg:inline">
          AI tenant line · demo
        </span>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-white/20 sm:block" />
        <HeaderNav />
      </div>
      {right}
    </header>
  );
}
