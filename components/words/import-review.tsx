"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  estimateSuggestTypesAction,
  findExistingAction,
  importWordsAction,
  suggestTypesAction,
} from "@/app/(app)/words/import/actions";
import { AiErrorMessage } from "@/components/ai-error-message";
import { Button } from "@/components/ui/button";
import type { AiErrorPayload } from "@/lib/ai/errors";
import type { Language } from "@/lib/languages";
import { classifyRows, countByStatus, rowsToImport, type ImportRow } from "@/lib/words/import";
import type { BulkResult } from "@/lib/words/queries";
import { ImportPreview } from "./import-preview";

type Estimate = { usd: number | null; calls: number; model: string; count: number };

/** Preview + duplicate check + optional AI types + import, shared by CSV and photo import. */
export function ImportReview({
  rows,
  setRows,
  language,
  source,
}: {
  rows: ImportRow[];
  setRows: (rows: ImportRow[]) => void;
  language: Language;
  source: "import_csv" | "import_photo";
}) {
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [updateExisting, setUpdateExisting] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [aiError, setAiError] = useState<AiErrorPayload | null>(null);
  const [result, setResult] = useState<(BulkResult & { invalid: number }) | null>(null);
  const [pending, start] = useTransition();

  // Re-check duplicates against the bank whenever terms / primary meanings change.
  const keySource = useMemo(
    () => JSON.stringify(rows.map((r) => [r.term, r.meanings[0] ?? ""])),
    [rows],
  );
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const keys = await findExistingAction(
        rows.map((r) => ({ term: r.term, meanings: r.meanings.slice(0, 1) })),
      );
      if (!cancelled) setExisting(new Set(keys));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySource]);

  const classified = useMemo(() => classifyRows(rows, existing), [rows, existing]);
  const counts = countByStatus(classified);
  const toImport = rowsToImport(classified, updateExisting);
  const untyped = classified.filter((r) => r.status !== "invalid" && r.type === "other");

  function askEstimate() {
    setAiError(null);
    start(async () => {
      const payload = untyped.map((r) => ({ i: r.i, term: r.term, meaning: r.meanings[0] }));
      const est = await estimateSuggestTypesAction(payload);
      setEstimate({ ...est, count: payload.length });
    });
  }

  function runSuggest() {
    start(async () => {
      const payload = untyped.map((r) => ({ i: r.i, term: r.term, meaning: r.meanings[0] }));
      const res = await suggestTypesAction(payload);
      setEstimate(null);
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      const byId = new Map(res.types.map((t) => [t.i, t.type]));
      setRows(rows.map((r) => (byId.has(r.i) ? { ...r, type: byId.get(r.i)! } : r)));
    });
  }

  function runImport() {
    start(async () => {
      const res = await importWordsAction(
        toImport.map((r) => ({
          term: r.term,
          meanings: r.meanings,
          type: r.type,
          exampleSentence: r.exampleSentence,
          exampleTranslation: r.exampleTranslation,
        })),
        { updateExisting, source },
      );
      setResult(res);
    });
  }

  if (result) {
    return (
      <section
        aria-label="Import result"
        role="status"
        className="bg-good-soft flex flex-col gap-3 rounded-2xl p-5"
      >
        <span className="font-display text-2xl font-medium">Import done</span>
        <p className="text-[15px] tabular-nums" data-testid="import-result">
          {result.inserted} inserted · {result.updated} updated · {result.skipped} skipped
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/words">Open the word bank</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/words?noex=1">Words without example</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] tabular-nums" data-testid="import-counts">
        <span className="font-semibold">{counts.new} new</span>
        <span className="text-muted-foreground">
          {" "}
          · {counts.duplicate} duplicate · {counts.invalid} invalid · {counts.missingExample}{" "}
          missing example
        </span>
      </p>

      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          className="accent-primary size-5"
          checked={updateExisting}
          onChange={(e) => setUpdateExisting(e.target.checked)}
        />
        Update existing words (add new meanings and examples)
      </label>

      {untyped.length > 0 && (
        <div className="bg-card flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px]">
              {untyped.length} {untyped.length === 1 ? "row has" : "rows have"} type “Other”.
            </span>
            {!estimate && (
              <Button type="button" variant="outline" onClick={askEstimate} disabled={pending}>
                Suggest types with AI
              </Button>
            )}
          </div>
          {estimate && (
            <div className="flex flex-wrap items-center gap-2" role="status">
              <span className="text-[13px]" data-testid="ai-estimate">
                {estimate.usd === null
                  ? `No price set for ${estimate.model} — add it in Settings first.`
                  : `${estimate.count} words · ${estimate.calls} ${estimate.calls === 1 ? "call" : "calls"} · up to $${estimate.usd.toFixed(4)}`}
              </span>
              {estimate.usd !== null && (
                <Button type="button" onClick={runSuggest} disabled={pending}>
                  {pending ? "Suggesting…" : "Run"}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setEstimate(null)}>
                Cancel
              </Button>
            </div>
          )}
          <AiErrorMessage error={aiError} />
        </div>
      )}

      <ImportPreview rows={classified} language={language} onChange={setRows} />

      <div className="bg-background/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex items-center gap-3 border-t py-3 md:bottom-0">
        <Button size="lg" onClick={runImport} disabled={pending || toImport.length === 0}>
          {pending
            ? "Working…"
            : `Import ${toImport.length} ${toImport.length === 1 ? "word" : "words"}`}
        </Button>
        <span className="text-muted-foreground text-[12px]">
          Missing examples are flagged, not generated.
        </span>
      </div>
    </div>
  );
}
