import type { InputHTMLAttributes, TextareaHTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const base =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-zinc-400 focus:border-amber-500 focus:outline-2 focus:outline-amber-500/30";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-20 resize-y", className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-zinc-700", className)} {...props} />;
}
