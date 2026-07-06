import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className="flex justify-center py-12">
      <LoaderCircle className={cn("h-7 w-7 animate-spin text-amber-500", className)} />
    </div>
  );
}
