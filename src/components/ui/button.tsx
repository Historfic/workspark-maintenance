import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-ink-muted",
  secondary: "border border-line bg-surface text-ink hover:bg-bg disabled:text-ink-muted/60",
  ghost: "text-accent hover:bg-accent/10 disabled:text-ink-muted/60",
};

const SIZE: Record<Size, string> = {
  md: "h-10 px-4 text-[15px]",
  sm: "h-8 px-3 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
}
