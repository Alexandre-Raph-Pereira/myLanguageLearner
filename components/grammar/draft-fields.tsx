"use client";

import { Plus, Search, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/components/ui/target-text";
import { GRAMMAR_LINK_KINDS, type GrammarLinkKind } from "@/db/schema/grammar";
import type { ReviewDraft } from "@/lib/grammar/schema";
import { TARGET_FONT_CLASS, type Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { LessonMarkdown } from "./markdown";
import { TagInput } from "./tag-input";

/** Existing lesson as offered by the related-lessons picker / duplicate check. */
export type LessonOption = {
  id: string;
  title: string;
  meaningShort: string;
  matchKeys: string[];
};

export type FieldErrors = Partial<Record<string, string>>;

const KIND_LABELS: Record<GrammarLinkKind, string> = {
  similar: "Similar",
  contrast: "Contrast",
  prerequisite: "Prerequisite",
};

const selectClass =
  "bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-lg border px-2.5 text-[15px] outline-none focus-visible:ring-3";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <span className="text-muted-foreground text-xs">{hint}</span>}
      {error && (
        <span role="alert" className="text-wrong-text text-xs font-medium">
          {error}
        </span>
      )}
    </div>
  );
}

function MarkdownField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const id = useId();
  const [preview, setPreview] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-semibold">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          aria-pressed={preview}
          aria-label={`${preview ? "Edit" : "Preview"} ${label}`}
          className="text-brass-text min-h-8 px-1 text-xs font-semibold"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="bg-card min-h-16 rounded-lg border px-3 py-2">
          {value.trim() ? (
            <LessonMarkdown>{value}</LessonMarkdown>
          ) : (
            <span className="text-muted-foreground text-[13px]">Empty</span>
          )}
        </div>
      ) : (
        <Textarea
          id={id}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className="text-[15px] md:text-[15px]"
        />
      )}
    </div>
  );
}

function RelatedPicker({
  value,
  onChange,
  lessons,
  excludeId,
  language,
}: {
  value: ReviewDraft["related"];
  onChange: (next: ReviewDraft["related"]) => void;
  lessons: LessonOption[];
  excludeId?: string;
  language: Language;
}) {
  const [q, setQ] = useState("");
  const query = q.normalize("NFC").trim().toLowerCase();
  const taken = new Set(value.map((r) => r.id));
  const matches = query
    ? lessons
        .filter(
          (l) =>
            l.id !== excludeId &&
            !taken.has(l.id) &&
            (l.title.toLowerCase().includes(query) ||
              l.meaningShort.toLowerCase().includes(query) ||
              l.matchKeys.some((k) => k.includes(query.replace(/\s+/g, "")))),
        )
        .slice(0, 6)
    : [];

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul aria-label="Related lessons" className="flex flex-col gap-1.5">
          {value.map((r) => (
            <li
              key={r.id}
              className="bg-track/60 flex items-center gap-2 rounded-lg py-1 pr-1 pl-3"
            >
              <T lang={language} className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {r.title}
              </T>
              <select
                aria-label={`Link kind for ${r.title}`}
                value={r.kind}
                onChange={(e) =>
                  onChange(
                    value.map((x) =>
                      x.id === r.id ? { ...x, kind: e.target.value as GrammarLinkKind } : x,
                    ),
                  )
                }
                className={cn(selectClass, "h-9 text-[13px]")}
              >
                {GRAMMAR_LINK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`Remove link to ${r.title}`}
                onClick={() => onChange(value.filter((x) => x.id !== r.id))}
                className="hover:bg-track inline-flex size-9 items-center justify-center rounded-full"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {lessons.length > 0 ? (
        <div className="relative">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Link an existing lesson"
            aria-label="Search lessons to link"
            autoComplete="off"
            className="pl-9"
          />
        </div>
      ) : (
        <span className="text-muted-foreground text-[13px]">No other lessons to link yet.</span>
      )}
      {matches.length > 0 && (
        <ul aria-label="Matching lessons" className="bg-card divide-y rounded-lg border">
          {matches.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, { id: l.id, title: l.title, kind: "similar", note: null }]);
                  setQ("");
                }}
                className="hover:bg-track/60 flex min-h-11 w-full items-center gap-2 px-3 text-left"
              >
                <Plus aria-hidden className="text-muted-foreground size-4 shrink-0" />
                <T lang={language} className="font-semibold">
                  {l.title}
                </T>
                <span className="text-muted-foreground truncate text-[13px]">{l.meaningShort}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every editable field of a lesson draft (controlled). Shared by review and edit. */
export function DraftFields({
  value,
  onChange,
  errors = {},
  language,
  exam,
  lessons,
  lessonId,
  compact = false,
}: {
  value: ReviewDraft;
  onChange: (patch: Partial<ReviewDraft>) => void;
  errors?: FieldErrors;
  language: Language;
  exam: string;
  lessons: LessonOption[];
  /** Lesson being edited (excluded from the related picker). */
  lessonId?: string;
  compact?: boolean;
}) {
  const id = useId();
  const font = TARGET_FONT_CLASS[language];
  const setExample = (i: number, patch: Partial<ReviewDraft["examples"][number]>) =>
    onChange({ examples: value.examples.map((e, k) => (k === i ? { ...e, ...patch } : e)) });

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("grid gap-4", !compact && "md:grid-cols-2")}>
        <Field label="Title" htmlFor={`${id}-title`} error={errors.title}>
          <Input
            id={`${id}-title`}
            lang={language}
            value={value.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-invalid={errors.title ? true : undefined}
            placeholder="-(으)ㄹ 수 있다"
            className={cn("text-lg md:text-lg", font)}
          />
        </Field>
        <Field
          label="Pattern"
          htmlFor={`${id}-pattern`}
          error={errors.pattern}
          hint="Canonical form; empty = same as the title"
        >
          <Input
            id={`${id}-pattern`}
            lang={language}
            value={value.pattern}
            onChange={(e) => onChange({ pattern: e.target.value })}
            aria-invalid={errors.pattern ? true : undefined}
            className={cn("text-[15px] md:text-[15px]", font)}
          />
        </Field>
      </div>

      <Field
        label="Forms (variants)"
        htmlFor={`${id}-variants`}
        error={errors.variants}
        hint="Every surface form: Enter or comma adds one"
      >
        <TagInput
          id={`${id}-variants`}
          value={value.variants}
          onChange={(variants) => onChange({ variants })}
          language={language}
          label="Add a form"
          placeholder="-을 수 있다"
        />
      </Field>

      <div className={cn("grid gap-4", !compact && "md:grid-cols-[1fr_10rem]")}>
        <Field label="Meaning" htmlFor={`${id}-meaning`} error={errors.meaning_short}>
          <Input
            id={`${id}-meaning`}
            value={value.meaning_short}
            onChange={(e) => onChange({ meaning_short: e.target.value })}
            aria-invalid={errors.meaning_short ? true : undefined}
            placeholder="can, be able to"
          />
        </Field>
        <Field label="Level" htmlFor={`${id}-level`} error={errors.level}>
          <select
            id={`${id}-level`}
            value={value.level ?? ""}
            onChange={(e) => onChange({ level: e.target.value ? Number(e.target.value) : null })}
            className={selectClass}
          >
            <option value="">Unknown</option>
            {[1, 2, 3, 4, 5, 6].map((l) => (
              <option key={l} value={l}>
                {exam} {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <MarkdownField
        label="Explanation"
        value={value.description_md}
        onChange={(description_md) => onChange({ description_md })}
      />
      <MarkdownField
        label="Formation"
        value={value.formation_md}
        onChange={(formation_md) => onChange({ formation_md })}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">Examples</legend>
        <ol className="flex flex-col gap-2">
          {value.examples.map((e, i) => (
            <li key={i} className="bg-track/40 flex items-start gap-2 rounded-xl p-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input
                  lang={language}
                  value={e.sentence}
                  onChange={(ev) => setExample(i, { sentence: ev.target.value })}
                  aria-label={`Example ${i + 1} sentence`}
                  className={cn("text-[15px] md:text-[15px]", font)}
                />
                <Input
                  value={e.translation}
                  onChange={(ev) => setExample(i, { translation: ev.target.value })}
                  aria-label={`Example ${i + 1} translation`}
                  placeholder="Translation"
                />
              </div>
              <button
                type="button"
                aria-label={`Remove example ${i + 1}`}
                onClick={() => onChange({ examples: value.examples.filter((_, k) => k !== i) })}
                className="hover:bg-track inline-flex size-11 shrink-0 items-center justify-center rounded-full"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ol>
        {errors.examples && (
          <span role="alert" className="text-wrong-text text-xs font-medium">
            {errors.examples}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() =>
            onChange({ examples: [...value.examples, { sentence: "", translation: "" }] })
          }
        >
          <Plus aria-hidden /> Add example
        </Button>
      </fieldset>

      <MarkdownField
        label="Similar · be careful"
        value={value.similar_md}
        onChange={(similar_md) => onChange({ similar_md })}
        rows={3}
      />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">Related lessons</legend>
        <RelatedPicker
          value={value.related}
          onChange={(related) => onChange({ related })}
          lessons={lessons}
          excludeId={lessonId}
          language={language}
        />
      </fieldset>
    </div>
  );
}
