"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/** − value + stepper with 44 px buttons; submits through a hidden input. */
export function Stepper({
  name,
  label,
  unit,
  defaultValue,
  min,
  max,
  step = 1,
  className,
}: {
  name: string;
  label: string;
  unit?: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  className?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const set = (v: number) => setValue(Math.min(max, Math.max(min, v)));
  const btn =
    "border-border-strong bg-card text-foreground hover:bg-track focus-visible:ring-ring/50 inline-flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none focus-visible:ring-3 disabled:opacity-40";
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span id={`${id}-label`} className="text-[15px] font-semibold">
        {label}
      </span>
      <div role="group" aria-labelledby={`${id}-label`} className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => set(value - step)}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <output
          aria-live="polite"
          aria-label={label}
          className="font-display w-14 text-center text-2xl font-medium tabular-nums"
        >
          {value}
        </output>
        <button
          type="button"
          className={btn}
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => set(value + step)}
        >
          <Plus className="size-4" aria-hidden />
        </button>
        {unit && <span className="sr-only">{unit}</span>}
        <input type="hidden" name={name} value={value} />
      </div>
    </div>
  );
}
