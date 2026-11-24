"use client";

import { Check, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveGrammarDraftAction } from "@/app/(app)/grammar/review-actions";
import { AiErrorMessage } from "@/components/ai-error-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/components/ui/target-text";
import type { AiErrorPayload } from "@/lib/ai/errors";
import {
  formatEstimate,
  rewriteEstimate,
  structureEstimate,
  type GrammarCostInfo,
} from "@/lib/grammar/cost";
import { draftForRewrite, draftToNotes, effectivePattern } from "@/lib/grammar/drafts";
import { findPossibleDuplicates } from "@/lib/grammar/normalize";
import type { SaveSource } from "@/lib/grammar/save";
import type { ReviewDraft } from "@/lib/grammar/schema";
import type { Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { DraftFields, type FieldErrors, type LessonOption } from "./draft-fields";

/** One draft waiting for review. `previous` = the version before the last rewrite (Undo). */
export type ReviewItem = {
  key: string;
  draft: ReviewDraft;
  previous: ReviewDraft | null;
  source: SaveSource;
  /** Editing an existing lesson (update instead of create). */
  lessonId?: string;
};

export function newItemKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export type SavedLesson = { id: string; title: string; created: boolean };

type Props = {
  items: ReviewItem[];
  onItemsChange: (update: (items: ReviewItem[]) => ReviewItem[]) => void;
  lessons: LessonOption[];
  language: Language;
  exam: string;
  cost: GrammarCostInfo;
  /** Narrow layout (drawer, plan 05): single column, lighter chrome. */
  compact?: boolean;
  onSaved?: (lesson: SavedLesson) => void;
  /** Label of the discard action (edit page: "Cancel"). */
  discardLabel?: string;
  onDiscard?: (item: ReviewItem) => void;
};

/** Review screen: one editable card per draft with Save / Rewrite (+ Undo) / Discard. */
export function GrammarDraftReview({
  items,
  onItemsChange,
  lessons,
  language,
  exam,
  cost,
  compact = false,
  onSaved,
  discardLabel = "Discard",
  onDiscard,
}: Props) {
  const [saved, setSaved] = useState<SavedLesson[]>([]);
  const [added, setAdded] = useState<LessonOption[]>([]);
  const allLessons = [...lessons, ...added];

  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-5")}>
      {saved.length > 0 && (
        <ul aria-label="Saved lessons" className="flex flex-col gap-2">
          {saved.map((s) => (
            <li
              key={s.id}
              className="bg-good-soft flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-[15px]"
            >
              <Check aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                Saved{" "}
                <T lang={language} className="font-semibold">
                  {s.title}
                </T>
                {s.created && " · counts as today's grammar lesson"}
              </span>
              <Link href={`/grammar/${s.id}`} className="shrink-0 font-semibold underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.map((item, i) => (
        <DraftCard
          key={item.key}
          item={item}
          index={i}
          total={items.length}
          lessons={allLessons}
          language={language}
          exam={exam}
          cost={cost}
          compact={compact}
          discardLabel={discardLabel}
          onChange={(patch) =>
            onItemsChange((list) => list.map((x) => (x.key === item.key ? { ...x, ...patch } : x)))
          }
          onExpand={(drafts) =>
            onItemsChange((list) =>
              list.flatMap((x) =>
                x.key !== item.key
                  ? [x]
                  : drafts.map((d, k) =>
                      k === 0
                        ? { ...x, draft: d, previous: x.draft }
                        : { key: newItemKey(), draft: d, previous: null, source: x.source },
                    ),
              ),
            )
          }
          onDiscard={() => {
            onItemsChange((list) => list.filter((x) => x.key !== item.key));
            onDiscard?.(item);
          }}
          onSaved={(lesson, draft) => {
            onItemsChange((list) => list.filter((x) => x.key !== item.key));
            setSaved((list) => [lesson, ...list.filter((s) => s.id !== lesson.id)]);
            if (lesson.created) {
              setAdded((list) => [
                ...list,
                {
                  id: lesson.id,
                  title: lesson.title,
                  meaningShort: draft.meaning_short,
                  matchKeys: [],
                },
              ]);
            }
            onSaved?.(lesson);
          }}
        />
      ))}
    </div>
  );
}

function DraftCard({
  item,
  index,
  total,
  lessons,
  language,
  exam,
  cost,
  compact,
  discardLabel,
  onChange,
  onExpand,
  onDiscard,
  onSaved,
}: {
  item: ReviewItem;
  index: number;
  total: number;
  lessons: LessonOption[];
  language: Language;
  exam: string;
  cost: GrammarCostInfo;
  compact: boolean;
  discardLabel: string;
  onChange: (patch: Partial<ReviewItem>) => void;
  /** Replace this draft by AI drafts (first one keeps Undo), from "Complete with AI". */
  onExpand: (drafts: ReviewDraft[]) => void;
  onDiscard: () => void;
  onSaved: (lesson: SavedLesson, draft: ReviewDraft) => void;
}) {
  const { draft } = item;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [serverDups, setServerDups] = useState<{ id: string; title: string }[]>([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [aiError, setAiError] = useState<AiErrorPayload | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [saving, startSave] = useTransition();

  const localDups = findPossibleDuplicates(
    { pattern: effectivePattern(draft), variants: draft.variants },
    lessons.filter((l) => l.matchKeys.length > 0),
    item.lessonId,
  );
  const dups = [
    ...localDups.map((d) => ({ id: d.id, title: d.title })),
    ...serverDups.filter((s) => !localDups.some((d) => d.id === s.id)),
  ];
  const showDupBanner = dups.length > 0 && !allowDuplicate;
  const busy = saving || rewriting;

  function update(patch: Partial<ReviewDraft>) {
    onChange({ draft: { ...draft, ...patch } });
  }

  function save(force = allowDuplicate) {
    setMessage(null);
    startSave(async () => {
      const r = await saveGrammarDraftAction({
        draft,
        source: item.source,
        lessonId: item.lessonId ?? null,
        allowDuplicate: force,
      });
      if (r.status === "saved") {
        onSaved({ id: r.id, title: r.title, created: r.created }, draft);
      } else if (r.status === "duplicate") {
        setServerDups(r.duplicates);
        setAllowDuplicate(false);
      } else if (r.status === "invalid") {
        setErrors(r.errors);
        setMessage(r.message);
      } else {
        setMessage("This lesson no longer exists.");
      }
    });
  }

  async function rewrite() {
    setAiError(null);
    setRewriting(true);
    try {
      const res = await fetch("/api/grammar/rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft, instruction: instruction.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.draft) {
        setAiError(body.error ?? { kind: "ai", message: `Request failed (${res.status}).` });
        return;
      }
      onChange({ draft: body.draft as ReviewDraft, previous: draft });
      setRewriteOpen(false);
      setInstruction("");
      setErrors({});
    } catch {
      setAiError({ kind: "ai", message: "Could not reach the server." });
    } finally {
      setRewriting(false);
    }
  }

  async function completeWithAi() {
    setAiError(null);
    setRewriting(true);
    try {
      const res = await fetch("/api/grammar/structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: draftToNotes(draft) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(body.drafts)) {
        setAiError(body.error ?? { kind: "ai", message: `Request failed (${res.status}).` });
        return;
      }
      if (body.drafts.length === 0) {
        setAiError({ kind: "ai", message: "The AI found no grammar point in this form." });
        return;
      }
      onExpand(body.drafts as ReviewDraft[]);
      setErrors({});
    } catch {
      setAiError({ kind: "ai", message: "Could not reach the server." });
    } finally {
      setRewriting(false);
    }
  }

  // Manual drafts not yet touched by the AI offer "Complete with AI" instead of Rewrite.
  const canComplete = item.source === "manual" && !item.lessonId && !item.previous;
  const notes = canComplete ? draftToNotes(draft) : "";
  const completeCost = canComplete ? structureEstimate(cost, { notes }) : null;
  const estimate = rewriteEstimate(cost, draftForRewrite(draft), instruction);
  const heading = draft.title.trim() || "Untitled lesson";

  return (
    <section
      aria-label={`Draft: ${heading}`}
      data-testid="grammar-draft"
      className={cn(
        "bg-card flex flex-col gap-4 rounded-2xl border",
        compact ? "p-3" : "p-4 md:p-5",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {total > 1 && (
            <span className="overline-label">
              Draft {index + 1} of {total}
            </span>
          )}
          <T lang={language} className="truncate text-xl font-semibold">
            {heading}
          </T>
        </div>
        {item.previous && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onChange({ draft: item.previous!, previous: null })}
          >
            <RotateCcw aria-hidden /> Undo rewrite
          </Button>
        )}
      </div>

      {showDupBanner && (
        <div
          role="alert"
          className="bg-level-1/15 flex flex-col gap-2 rounded-xl p-3 text-[14px]"
          data-testid="duplicate-warning"
        >
          <span className="flex items-start gap-2 font-semibold">
            <TriangleAlert aria-hidden className="text-level-1-text mt-0.5 size-4 shrink-0" />
            <span>
              Possible duplicate of{" "}
              {dups.map((d, k) => (
                <span key={d.id}>
                  {k > 0 && ", "}
                  <Link href={`/grammar/${d.id}`} className="underline" target="_blank">
                    <T lang={language}>{d.title}</T>
                  </Link>
                </span>
              ))}
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setAllowDuplicate(true);
                if (serverDups.length > 0) save(true);
              }}
            >
              Save anyway
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDiscard}>
              {discardLabel}
            </Button>
          </div>
        </div>
      )}

      <DraftFields
        value={draft}
        onChange={update}
        errors={errors}
        language={language}
        exam={exam}
        lessons={lessons}
        lessonId={item.lessonId}
        compact={compact}
      />

      {rewriteOpen && (
        <div className="bg-track/40 flex flex-col gap-2 rounded-xl p-3">
          <label htmlFor={`rewrite-${item.key}`} className="text-[13px] font-semibold">
            What should change? (optional)
          </label>
          <Textarea
            id={`rewrite-${item.key}`}
            value={instruction}
            maxLength={500}
            rows={2}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Shorter description, more casual examples…"
            className="text-[15px] md:text-[15px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={busy || cost.rates === null} onClick={rewrite}>
              <Sparkles aria-hidden /> {rewriting ? "Rewriting…" : "Rewrite with AI"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setRewriteOpen(false)}
            >
              Cancel
            </Button>
            <span
              className="text-muted-foreground text-[13px] tabular-nums"
              data-testid="rewrite-cost"
            >
              {formatEstimate(estimate, cost.included)}
            </span>
          </div>
        </div>
      )}
      <AiErrorMessage error={aiError} />
      {message && (
        <p role="alert" className="text-wrong-text text-[13px] font-medium">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="button"
          disabled={busy || showDupBanner}
          onClick={() => save()}
          className="flex-1 sm:flex-none"
        >
          <Check aria-hidden /> {saving ? "Saving…" : "Save"}
        </Button>
        {canComplete && (
          <Button
            type="button"
            variant="outline"
            disabled={busy || !notes || cost.rates === null}
            onClick={completeWithAi}
            title={formatEstimate(completeCost, cost.included)}
          >
            <Sparkles aria-hidden /> {rewriting ? "Completing…" : "Complete with AI"}
            {notes && (
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {formatEstimate(completeCost, cost.included)}
              </span>
            )}
          </Button>
        )}
        {!rewriteOpen && !canComplete && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setRewriteOpen(true)}
          >
            <Sparkles aria-hidden /> Rewrite
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={busy} onClick={onDiscard}>
          {discardLabel}
        </Button>
      </div>
    </section>
  );
}
