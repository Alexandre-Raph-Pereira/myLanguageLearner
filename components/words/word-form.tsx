"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WORD_TYPES, type Word } from "@/db/schema/words";
import { TARGET_FONT_CLASS, type Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/words/filters";
import { WORD_FORM_IDLE, type WordFormState } from "@/lib/words/form";
import { MeaningsInput } from "./meanings-input";

type Action = (state: WordFormState, fd: FormData) => Promise<WordFormState>;

export const selectClass =
  "bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-[15px] outline-none focus-visible:ring-3";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold">
      {children}
    </label>
  );
}

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="text-wrong-text text-[13px]">
      {msg}
    </p>
  );
}

/** Create / edit form for a word (server action + zod validation messages). */
export function WordForm({
  action,
  word,
  language,
  submitLabel,
  allowAddAnother = false,
}: {
  action: Action;
  word?: Word;
  language: Language;
  submitLabel: string;
  allowAddAnother?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, WORD_FORM_IDLE);
  const f = state.status === "error" ? state.fields : {};
  return (
    <form action={formAction} aria-label="Word" className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="term">Term (dictionary form)</Label>
        <Input
          id="term"
          name="term"
          lang={language}
          defaultValue={word?.term}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!f.term || undefined}
          aria-describedby={f.term ? "term-error" : undefined}
          className={cn("text-lg", TARGET_FONT_CLASS[language])}
          required
        />
        <Err id="term-error" msg={f.term} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meaningDraft">Meanings (first = primary)</Label>
        <MeaningsInput
          defaultValue={word?.meanings}
          invalid={!!f.meanings}
          describedBy={f.meanings ? "meanings-error" : "meanings-help"}
        />
        <p id="meanings-help" className="text-muted-foreground text-[12px]">
          Press Enter or comma to add. Every meaning is an accepted answer.
        </p>
        <Err id="meanings-error" msg={f.meanings} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Type</Label>
        <select id="type" name="type" defaultValue={word?.type ?? "other"} className={selectClass}>
          {WORD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exampleSentence">Example sentence</Label>
        <Textarea
          id="exampleSentence"
          name="exampleSentence"
          lang={language}
          defaultValue={word?.exampleSentence ?? ""}
          rows={2}
          className={TARGET_FONT_CLASS[language]}
          aria-invalid={!!f.exampleSentence || undefined}
        />
        <Err id="example-error" msg={f.exampleSentence} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exampleTranslation">Example translation</Label>
        <Textarea
          id="exampleTranslation"
          name="exampleTranslation"
          defaultValue={word?.exampleTranslation ?? ""}
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={word?.notes ?? ""} rows={2} />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-wrong-text text-[13px] font-semibold">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {allowAddAnother && (
          <Button type="submit" name="addAnother" value="1" variant="outline" disabled={pending}>
            Save and add another
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href="/words">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
