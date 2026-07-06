import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const variants = {
  neutral: "bg-zinc-200 text-zinc-700",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
  purple: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-800",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
