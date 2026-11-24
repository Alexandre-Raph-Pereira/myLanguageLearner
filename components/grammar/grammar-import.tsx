"use client";

import { Camera, ImagePlus, PenLine, Sparkles } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { AiErrorMessage } from "@/components/ai-error-message";
import { ProgressBar } from "@/components/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AiErrorPayload } from "@/lib/ai/errors";
import { formatEstimate, structureEstimate, type GrammarCostInfo } from "@/lib/grammar/cost";
import type { SaveSource } from "@/lib/grammar/save";
import { emptyDraft, type ReviewDraft } from "@/lib/grammar/schema";
import type { Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { resizeImage } from "@/lib/words/resize";
import type { LessonOption } from "./draft-fields";
import { GrammarDraftReview, newItemKey, type ReviewItem } from "./draft-review";

const MAX_PHOTOS = 5;
export const REVIEW_STORAGE_KEY = "grammar-review:new";

type Tab = "write" | "text" | "photo";
const TABS: { id: Tab; label: string }[] = [
  { id: "write", label: "Write" },
  { id: "text", label: "From text" },
  { id: "photo", label: "From photo" },
];

/** Unsaved drafts survive a refresh (sessionStorage; this component renders client-only). */
function loadItems(): ReviewItem[] {
  try {
    const raw = sessionStorage.getItem(REVIEW_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ReviewItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.key && i.draft) : [];
  } catch {
    return [];
  }
}

function storeItems(items: ReviewItem[]) {
  try {
    if (items.length === 0) sessionStorage.removeItem(REVIEW_STORAGE_KEY);
    else sessionStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full / blocked: drafts just won't survive a refresh
  }
}

const toItems = (drafts: ReviewDraft[], source: SaveSource): ReviewItem[] =>
  drafts.map((draft) => ({ key: newItemKey(), draft, previous: null, source }));

/** `/grammar/new`: Write / From text / From photo → shared review (nothing saved without Save). */
export function GrammarImport({
  language,
  exam,
  lessons,
  cost,
}: {
  language: Language;
  exam: string;
  lessons: LessonOption[];
  cost: GrammarCostInfo;
}) {
  const [items, setItems] = useState<ReviewItem[]>(loadItems);
  const [tab, setTab] = useState<Tab>("text");

  useEffect(() => storeItems(items), [items]);

  const append = (drafts: ReviewDraft[], source: SaveSource) =>
    setItems((list) => [...list, ...toItems(drafts, source)]);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="How to add a lesson"
        className="bg-track grid grid-cols-3 gap-1 rounded-xl p-1 md:max-w-md"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 rounded-lg text-[14px] font-semibold transition-colors",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "write" && (
          <WritePanel
            onStart={() => append([emptyDraft()], "manual")}
            hasManual={items.some((i) => i.source === "manual")}
          />
        )}
        {tab === "text" && <TextPanel cost={cost} onDrafts={(d) => append(d, "import_text")} />}
        {tab === "photo" && <PhotoPanel cost={cost} onDrafts={(d) => append(d, "import_photo")} />}
      </div>

      <section aria-label="Review" className="flex flex-col gap-3">
        {items.length > 0 && (
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-2xl font-medium">Review</h2>
            <p className="text-muted-foreground text-[13px]">
              Nothing is stored until you press Save. Unsaved drafts are kept if you reload this
              page.
            </p>
          </div>
        )}
        {/* Always mounted so the "Saved" confirmations stay after the last draft is saved. */}
        <GrammarDraftReview
          items={items}
          onItemsChange={setItems}
          lessons={lessons}
          language={language}
          exam={exam}
          cost={cost}
        />
      </section>
    </div>
  );
}

function WritePanel({ onStart, hasManual }: { onStart: () => void; hasManual: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-[15px]">
        Write a lesson yourself. Fill what you know, then save it as is or press{" "}
        <strong className="text-foreground">Complete with AI</strong> to fill the rest.
      </p>
      <Button type="button" onClick={onStart}>
        <PenLine aria-hidden /> {hasManual ? "Another empty lesson" : "Start an empty lesson"}
      </Button>
    </div>
  );
}

function TextPanel({
  cost,
  onDrafts,
}: {
  cost: GrammarCostInfo;
  onDrafts: (drafts: ReviewDraft[]) => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiErrorPayload | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function structure() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/grammar/structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(body.drafts)) {
        setError(body.error ?? { kind: "ai", message: `Request failed (${res.status}).` });
        return;
      }
      if (body.drafts.length === 0) {
        setInfo("No grammar point found in these notes.");
        return;
      }
      onDrafts(body.drafts);
      setNotes("");
      setInfo(
        `${body.drafts.length} ${body.drafts.length === 1 ? "draft" : "drafts"} added below.`,
      );
    } catch {
      setError({ kind: "ai", message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const estimate = structureEstimate(cost, { notes });
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="grammar-notes" className="text-[13px] font-semibold">
        Your notes
      </label>
      <Textarea
        id="grammar-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={8}
        maxLength={20_000}
        placeholder={"-(으)ㄹ 수 있다 = can\n갈 수 있어요 = I can go\n…"}
        className="min-h-40 text-[15px] md:text-[15px]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          disabled={busy || !notes.trim() || cost.rates === null}
          onClick={structure}
        >
          <Sparkles aria-hidden /> {busy ? "Structuring…" : "Structure with AI"}
        </Button>
        <span
          className="text-muted-foreground text-[13px] tabular-nums"
          data-testid="structure-cost"
        >
          {formatEstimate(estimate, cost.included)}
        </span>
      </div>
      {info && (
        <p role="status" className="text-[13px]">
          {info}
        </p>
      )}
      <AiErrorMessage error={error} />
    </div>
  );
}

function PhotoPanel({
  cost,
  onDrafts,
}: {
  cost: GrammarCostInfo;
  onDrafts: (drafts: ReviewDraft[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<{ name: string; error: AiErrorPayload }[]>([]);
  const [info, setInfo] = useState<string | null>(null);

  function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    setFiles((list) => [...list, ...picked].slice(0, MAX_PHOTOS));
    e.target.value = "";
  }

  async function read() {
    setErrors([]);
    setInfo(null);
    setProgress({ done: 0, total: files.length });
    const errs: { name: string; error: AiErrorPayload }[] = [];
    let count = 0;
    for (const [n, file] of files.entries()) {
      try {
        const blob = await resizeImage(file);
        const fd = new FormData();
        fd.append("image", blob, file.name.replace(/\.\w+$/, "") + ".jpg");
        const res = await fetch("/api/grammar/structure", { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          errs.push({
            name: file.name,
            error: body.error ?? { kind: "ai", message: `Request failed (${res.status}).` },
          });
          if (body.error?.kind === "budget") break;
        } else if (Array.isArray(body.drafts)) {
          count += body.drafts.length;
          onDrafts(body.drafts);
        }
      } catch {
        errs.push({
          name: file.name,
          error: { kind: "ai", message: "Could not send this photo." },
        });
      }
      setProgress({ done: n + 1, total: files.length });
    }
    setErrors(errs);
    setProgress(null);
    if (errs.length === 0) setFiles([]);
    setInfo(
      count === 0
        ? "No grammar point found on these photos."
        : `${count} ${count === 1 ? "draft" : "drafts"} added below.`,
    );
  }

  const busy = progress !== null;
  const one = structureEstimate(cost, { images: 1 });
  const estimate = one === null ? null : one * Math.max(files.length, 1);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="bg-card hover:bg-track/60 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-[15px] font-semibold">
          <ImagePlus aria-hidden className="size-6" />
          Choose photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={addFiles}
            disabled={busy || files.length >= MAX_PHOTOS}
            aria-label="Choose notebook photos"
          />
        </label>
        <label className="bg-card hover:bg-track/60 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-[15px] font-semibold">
          <Camera aria-hidden className="size-6" />
          Take a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={addFiles}
            disabled={busy || files.length >= MAX_PHOTOS}
            aria-label="Take a notebook photo"
          />
        </label>
      </div>
      {files.length > 0 && (
        <ul aria-label="Selected photos" className="bg-card divide-y rounded-2xl border">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="truncate text-[15px]">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setFiles((list) => list.filter((_, k) => k !== i))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-[13px]">
        Up to {MAX_PHOTOS} photos, one lesson page each. They are resized on your phone, read by the
        AI one by one and never stored.
      </p>
      {progress && (
        <div className="flex flex-col gap-1.5" role="status">
          <span className="text-[13px] tabular-nums">
            Reading photo {Math.min(progress.done + 1, progress.total)} of {progress.total}…
          </span>
          <ProgressBar
            pct={(progress.done / progress.total) * 100}
            tone="brass"
            label="Photos read"
          />
        </div>
      )}
      {errors.map((e) => (
        <div key={e.name} className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">{e.name}</span>
          <AiErrorMessage error={e.error} />
        </div>
      ))}
      {info && !busy && (
        <p role="status" className="text-[13px]">
          {info}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          disabled={busy || files.length === 0 || cost.rates === null}
          onClick={read}
        >
          <Sparkles aria-hidden />
          {busy
            ? "Reading…"
            : `Read ${files.length || ""} ${files.length === 1 ? "photo" : "photos"}`}
        </Button>
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {formatEstimate(estimate, cost.included)}
          {files.length > 1 && one !== null ? ` (${files.length} calls)` : ""}
        </span>
      </div>
    </div>
  );
}
