"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import {
  buildRows,
  columnCount,
  DEFAULT_SPLIT,
  defaultMapping,
  detectSeparator,
  IMPORT_FIELDS,
  parseTable,
  type ImportField,
  type ImportRow,
  type Mapping,
  type MeaningSplit,
} from "@/lib/words/import";
import { ImportReview } from "./import-review";

const FIELD_LABELS: Record<ImportField, string> = {
  term: "Term",
  meaning: "Meaning",
  example_sentence: "Example",
  example_translation: "Example translation",
  type: "Type",
};

type SepChoice = "auto" | "tab" | "comma" | "semicolon" | "custom";
const SEP: Record<Exclude<SepChoice, "auto" | "custom">, string> = {
  tab: "\t",
  comma: ",",
  semicolon: ";",
};

const control =
  "bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-[15px] outline-none focus-visible:ring-3";

function sepName(s: string) {
  return s === "\t" ? "tab" : s === "," ? "comma" : s === ";" ? "semicolon" : `“${s}”`;
}

/** CSV/TSV paste or file → options → column mapping → shared review + import. */
export function CsvImport({ language }: { language: Language }) {
  const [text, setText] = useState("");
  const [sepChoice, setSepChoice] = useState<SepChoice>("auto");
  const [customSep, setCustomSep] = useState("|");
  const [header, setHeader] = useState(false);
  const [split, setSplit] = useState<MeaningSplit>(DEFAULT_SPLIT);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);

  const separator =
    sepChoice === "auto"
      ? detectSeparator(text)
      : sepChoice === "custom"
        ? customSep || ","
        : SEP[sepChoice];
  const table = useMemo(() => (text.trim() ? parseTable(text, separator) : []), [text, separator]);
  const cols = columnCount(table);
  const effective = mapping ?? defaultMapping(cols);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setMapping(null);
    setRows(null);
  }

  function setColumn(col: number, field: ImportField | "ignore") {
    const next: Mapping = { ...effective };
    for (const f of IMPORT_FIELDS) if (next[f] === col) next[f] = null;
    if (field !== "ignore") next[field] = col;
    setMapping(next);
  }

  const fieldOf = (col: number) =>
    (IMPORT_FIELDS.find((f) => effective[f] === col) ?? "ignore") as ImportField | "ignore";
  const canPreview = table.length > 0 && effective.term !== null && effective.meaning !== null;

  if (rows) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="self-start" onClick={() => setRows(null)}>
          ← Back to options (edits are lost)
        </Button>
        <ImportReview rows={rows} setRows={setRows} language={language} source="import_csv" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Source" className="flex flex-col gap-2">
        <label htmlFor="csv-text" className="text-[13px] font-semibold">
          Paste your Quizlet export (or any CSV / TSV)
        </label>
        <Textarea
          id="csv-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMapping(null);
          }}
          rows={8}
          lang={language}
          placeholder={"사과\tapple\n먹다\tto eat"}
          className="font-mono text-[13px]"
        />
        <label className="text-[13px]">
          <span className="font-semibold">or choose a file</span>{" "}
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={onFile}
            aria-label="CSV or TSV file"
            className="text-[13px]"
          />
        </label>
      </section>

      <section aria-label="Options" className="flex flex-col gap-3">
        <h2 className="overline-label">Options</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sep" className="text-[13px] font-semibold">
            Separator
          </label>
          <select
            id="sep"
            value={sepChoice}
            onChange={(e) => setSepChoice(e.target.value as SepChoice)}
            className={control}
          >
            <option value="auto">Auto-detect{text.trim() ? ` (${sepName(separator)})` : ""}</option>
            <option value="tab">Tab</option>
            <option value="comma">Comma</option>
            <option value="semicolon">Semicolon</option>
            <option value="custom">Custom</option>
          </select>
          {sepChoice === "custom" && (
            <input
              aria-label="Custom separator"
              value={customSep}
              maxLength={3}
              onChange={(e) => setCustomSep(e.target.value)}
              className={cn(control, "w-16 text-center")}
            />
          )}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            className="accent-primary size-5"
            checked={header}
            onChange={(e) => setHeader(e.target.checked)}
          />
          First row is a header
        </label>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="text-[13px] font-semibold">Split meanings on</legend>
          {(
            [
              ["semicolon", "; semicolon"],
              ["comma", ", comma"],
              ["slash", "/ slash"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-2 text-[15px]">
              <input
                type="checkbox"
                className="accent-primary size-5"
                checked={split[k]}
                onChange={(e) => setSplit({ ...split, [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      {cols > 0 && (
        <section aria-label="Column mapping" className="flex flex-col gap-3">
          <h2 className="overline-label">Columns · {table.length - (header ? 1 : 0)} rows</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} className="bg-card flex flex-col gap-2 rounded-xl border p-3">
                <label htmlFor={`col-${c}`} className="text-[13px] font-semibold">
                  Column {c + 1}
                </label>
                <select
                  id={`col-${c}`}
                  value={fieldOf(c)}
                  onChange={(e) => setColumn(c, e.target.value as ImportField | "ignore")}
                  className={control}
                >
                  <option value="ignore">Ignore</option>
                  {IMPORT_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
                <ul className="text-muted-foreground flex flex-col text-[12px]">
                  {table.slice(0, 3).map((r, i) => (
                    <li key={i} className="truncate" lang={c === 0 ? language : undefined}>
                      {r[c] || "—"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <Button
        size="lg"
        className="md:self-start"
        disabled={!canPreview}
        onClick={() => setRows(buildRows(table, effective, { header, split }))}
      >
        Preview
      </Button>
      {table.length > 0 && !canPreview && (
        <p className="text-wrong-text text-[13px]">Map a Term and a Meaning column.</p>
      )}
    </div>
  );
}
