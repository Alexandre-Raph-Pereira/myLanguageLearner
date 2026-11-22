"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { startWordTestAction, type StartState } from "@/app/(app)/tests/words/actions";
import { Button } from "@/components/ui/button";
import { WORD_TYPES, type WordType } from "@/db/schema/words";
import { cn } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/words/filters";

type Stat = { type: WordType; hasExample: boolean; total: number; due: number };

const DIRECTIONS = [
  { value: "en_ko", label: "EN → KR", sub: "Type the Korean word" },
  { value: "ko_en", label: "KR → EN", sub: "Type the meaning" },
  { value: "mixed", label: "Mixed", sub: "Both directions" },
] as const;

const chip =
  "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium has-checked:bg-primary has-checked:text-primary-foreground has-checked:border-transparent has-focus-visible:ring-3 has-focus-visible:ring-ring/50 cursor-pointer";

/** Word test settings: types, direction, count, "include words without example". */
export function WordTestParams({ stats }: { stats: Stat[] }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startWordTestAction, {});
  const [types, setTypes] = useState<WordType[]>([]);
  const [count, setCount] = useState(25);
  const [includeNoExample, setIncludeNoExample] = useState(true);
  const present = WORD_TYPES.filter((t) => stats.some((s) => s.type === t && s.total > 0));

  const matching = useMemo(() => {
    const rows = stats.filter(
      (s) => (types.length === 0 || types.includes(s.type)) && (includeNoExample || s.hasExample),
    );
    return {
      total: rows.reduce((a, r) => a + r.total, 0),
      due: rows.reduce((a, r) => a + r.due, 0),
    };
  }, [stats, types, includeNoExample]);

  const toggle = (t: WordType) =>
    setTypes((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
  const clamp = (n: number) => Math.min(50, Math.max(5, n));

  return (
    <form action={action} aria-label="Word test settings" className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="overline-label mb-2">Word types</legend>
        <div className="flex flex-wrap gap-2">
          <label className={chip}>
            <input
              type="checkbox"
              className="sr-only"
              checked={types.length === 0}
              onChange={() => setTypes([])}
            />
            All types
          </label>
          {present.map((t) => (
            <label key={t} className={chip}>
              <input
                type="checkbox"
                name="types"
                value={t}
                className="sr-only"
                checked={types.includes(t)}
                onChange={() => toggle(t)}
              />
              {TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="overline-label mb-2">Direction</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DIRECTIONS.map((d) => (
            <label
              key={d.value}
              className="bg-card has-checked:border-primary has-checked:ring-primary has-focus-visible:ring-ring/50 flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-checked:ring-1 has-focus-visible:ring-3"
            >
              <input
                type="radio"
                name="direction"
                value={d.value}
                defaultChecked={d.value === "en_ko"}
                className="sr-only"
              />
              <span className="text-[15px] font-semibold">{d.label}</span>
              <span className="text-muted-foreground text-[12px]">{d.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span id="count-label" className="overline-label">
          Number of words
        </span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Fewer words"
            onClick={() => setCount((c) => clamp(c - 5))}
            disabled={count <= 5}
          >
            <Minus aria-hidden />
          </Button>
          <input
            name="count"
            type="number"
            inputMode="numeric"
            min={5}
            max={50}
            value={count}
            aria-labelledby="count-label"
            onChange={(e) => setCount(Number(e.target.value))}
            onBlur={() => setCount((c) => clamp(Number.isFinite(c) ? c : 25))}
            className="font-display bg-card h-11 w-20 rounded-lg border text-center text-xl tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="More words"
            onClick={() => setCount((c) => clamp(c + 5))}
            disabled={count >= 50}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          name="includeNoExample"
          checked={includeNoExample}
          onChange={(e) => setIncludeNoExample(e.target.checked)}
          className="accent-primary size-5"
        />
        Include words without an example sentence
      </label>

      <p className="text-[15px]" data-testid="matching">
        <span className="font-semibold tabular-nums">{matching.due} due</span>
        <span className="text-muted-foreground"> / {matching.total} total matching</span>
      </p>

      {state.error && (
        <p role="alert" className="text-wrong-text text-[13px] font-semibold">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pending || matching.total === 0}
        className={cn("md:self-start")}
      >
        {pending ? "Starting…" : "Start test"}
      </Button>
    </form>
  );
}
