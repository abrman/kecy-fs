import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-sm",
  secondary:
    "bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 shadow-sm dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  danger: "bg-red-600 text-white hover:bg-red-500 shadow-sm",
  dangerGhost: "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60",
};

const sizes = {
  md: "h-9 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
  icon: "h-8 w-8",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
