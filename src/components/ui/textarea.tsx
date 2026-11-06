import { clsx } from "clsx";
import type { ComponentProps } from "react";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={clsx(
        "w-full resize-y rounded border border-line bg-surface px-3 py-2 text-[15px] leading-6 text-ink placeholder:text-ink-muted/70 disabled:bg-bg",
        className,
      )}
      {...props}
    />
  );
}
