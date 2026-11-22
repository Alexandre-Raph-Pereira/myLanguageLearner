"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { WORD_TYPES, type WordType } from "@/db/schema/words";
import { TARGET_FONT_CLASS, type Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/words/filters";
import { countByStatus, type ClassifiedRow, type ImportRow } from "@/lib/words/import";
import { dedupeMeanings } from "@/lib/words/input";

const PAGE = 50;
type View = "all" | "new" | "duplicate" | "invalid" | "missing" | "low";

const cellInput =
  "bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full min-w-0 rounded-lg border px-2.5 text-[15px] outline-none focus-visible:ring-3";

function StatusBadge({ row }: { row: ClassifiedRow }) {
  const cls =
    row.status === "new"
      ? "bg-good-soft text-level-2-text"
      : row.status === "invalid"
        ? "bg-wrong-soft text-wrong-text"
        : "bg-track text-muted-foreground";
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase", cls)}>
      {row.status === "duplicate" && row.inBank ? "in bank" : row.status}
    </span>
  );
}

/**
 * Editable review table shared by CSV and photo import: inline edits, status badges
 * (new / duplicate / invalid), "missing example" flag, low-confidence highlight,
 * filter views, selection and "set type for selected".
 */
export function ImportPreview({
  rows,
  language,
  onChange,
}: {
  rows: ClassifiedRow[];
  language: Language;
  onChange: (rows: ImportRow[]) => void;
}) {
  const [view, setView] = useState<View>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkType, setBulkType] = useState<WordType>("noun");

  const counts = countByStatus(rows);
  const low = rows.filter((r) => r.confidence === "low").length;
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        switch (view) {
          case "all":
            return true;
          case "missing":
            return r.status !== "invalid" && r.missingExample;
          case "low":
            return r.confidence === "low";
          default:
            return r.status === view;
        }
      }),
    [rows, view],
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * PAGE, current * PAGE + PAGE);

  const strip = (r: ClassifiedRow): ImportRow => ({
    i: r.i,
    term: r.term,
    meanings: r.meanings,
    exampleSentence: r.exampleSentence,
    exampleTranslation: r.exampleTranslation,
    type: r.type,
    confidence: r.confidence,
  });
  const update = (i: number, patch: Partial<ImportRow>) =>
    onChange(rows.map((r) => (r.i === i ? { ...strip(r), ...patch } : strip(r))));
  const remove = (ids: Set<number>) => {
    onChange(rows.filter((r) => !ids.has(r.i)).map(strip));
    setSelected(new Set());
  };
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.i));

  const views: { id: View; label: string; n: number }[] = [
    { id: "all", label: "All", n: rows.length },
    { id: "new", label: "New", n: counts.new },
    { id: "duplicate", label: "Duplicate", n: counts.duplicate },
    { id: "invalid", label: "Invalid", n: counts.invalid },
    { id: "missing", label: "Missing example", n: counts.missingExample },
    ...(low > 0 ? [{ id: "low" as const, label: "Low confidence", n: low }] : []),
  ];

  return (
    <section aria-label="Import preview" className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Preview filter"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => {
              setView(v.id);
              setPage(0);
            }}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
              view === v.id ? "bg-primary text-primary-foreground border-transparent" : "bg-card",
            )}
          >
            {v.label} <span className="tabular-nums opacity-80">{v.n}</span>
          </button>
        ))}
      </div>

      <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border p-2">
        <label className="flex min-h-10 items-center gap-2 px-1 text-[13px]">
          <input
            type="checkbox"
            className="accent-primary size-5"
            checked={allShownSelected}
            onChange={() =>
              setSelected((s) => {
                const next = new Set(s);
                for (const r of shown) {
                  if (allShownSelected) next.delete(r.i);
                  else next.add(r.i);
                }
                return next;
              })
            }
          />
          Select shown
        </label>
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {selected.size} selected
        </span>
        <select
          aria-label="Type for selected rows"
          value={bulkType}
          onChange={(e) => setBulkType(e.target.value as WordType)}
          className={cn(cellInput, "w-auto")}
        >
          {WORD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={selected.size === 0}
          onClick={() =>
            onChange(
              rows.map((r) => (selected.has(r.i) ? { ...strip(r), type: bulkType } : strip(r))),
            )
          }
        >
          Set type
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={selected.size === 0}
          onClick={() => remove(selected)}
        >
          Remove
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-[13px]">No rows in this view.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => (
            <li
              key={r.i}
              data-testid="import-row"
              data-status={r.status}
              className={cn(
                "bg-card flex flex-col gap-2 rounded-xl border p-3",
                r.confidence === "low" && "border-brass bg-brass/10",
                r.status === "invalid" && "border-wrong-text/40",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Select row ${r.i + 1}`}
                  className="accent-primary size-5"
                  checked={selected.has(r.i)}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (next.has(r.i)) next.delete(r.i);
                      else next.add(r.i);
                      return next;
                    })
                  }
                />
                <span className="text-muted-foreground text-[12px] tabular-nums">#{r.i + 1}</span>
                <StatusBadge row={r} />
                {r.status !== "invalid" && r.missingExample && (
                  <span className="text-level-1-text text-[12px] font-semibold">
                    missing example
                  </span>
                )}
                {r.confidence === "low" && (
                  <span className="text-brass-text text-[12px] font-semibold">
                    check handwriting
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_10rem]">
                <input
                  key={`t-${r.i}-${r.term}`}
                  aria-label={`Term row ${r.i + 1}`}
                  defaultValue={r.term}
                  lang={language}
                  placeholder="Term"
                  autoComplete="off"
                  onBlur={(e) => {
                    const v = e.target.value.normalize("NFC").trim();
                    if (v !== r.term) update(r.i, { term: v });
                  }}
                  className={cn(cellInput, "font-semibold", TARGET_FONT_CLASS[language])}
                />
                <input
                  key={`m-${r.i}-${r.meanings.join(";")}`}
                  aria-label={`Meanings row ${r.i + 1}`}
                  defaultValue={r.meanings.join("; ")}
                  placeholder="Meanings (; separated)"
                  autoComplete="off"
                  onBlur={(e) => {
                    const v = dedupeMeanings(e.target.value.split(";"));
                    if (v.join(";") !== r.meanings.join(";")) update(r.i, { meanings: v });
                  }}
                  className={cellInput}
                />
                <select
                  aria-label={`Type row ${r.i + 1}`}
                  value={r.type}
                  onChange={(e) => update(r.i, { type: e.target.value as WordType })}
                  className={cellInput}
                >
                  {WORD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  key={`e-${r.i}-${r.exampleSentence ?? ""}`}
                  aria-label={`Example row ${r.i + 1}`}
                  defaultValue={r.exampleSentence ?? ""}
                  lang={language}
                  placeholder="Example sentence"
                  autoComplete="off"
                  onBlur={(e) => {
                    const v = e.target.value.normalize("NFC").trim() || null;
                    if (v !== r.exampleSentence) update(r.i, { exampleSentence: v });
                  }}
                  className={cn(cellInput, TARGET_FONT_CLASS[language])}
                />
                <input
                  key={`x-${r.i}-${r.exampleTranslation ?? ""}`}
                  aria-label={`Translation row ${r.i + 1}`}
                  defaultValue={r.exampleTranslation ?? ""}
                  placeholder="Example translation"
                  autoComplete="off"
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== r.exampleTranslation) update(r.i, { exampleTranslation: v });
                  }}
                  className={cellInput}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Preview pages" className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-[13px] tabular-nums">
            {current + 1} / {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  );
}
