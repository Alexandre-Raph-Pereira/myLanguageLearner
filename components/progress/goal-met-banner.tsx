import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Hero-style banner: "Daily goal met · streak N days". */
export function GoalMetBanner({ streak, className }: { streak: number; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "bg-hero text-on-hero flex items-center gap-3 rounded-3xl px-5 py-4",
        className,
      )}
    >
      <span className="bg-hero-brass text-hero flex size-9 shrink-0 items-center justify-center rounded-full">
        <Check className="size-5" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold">
        Daily goal met · streak {streak} {streak === 1 ? "day" : "days"}
      </span>
    </div>
  );
}
