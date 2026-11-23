"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/** Tag input for meanings: Enter / comma / semicolon adds a tag; the first tag is primary. */
export function MeaningsInput({
  defaultValue = [],
  invalid,
  describedBy,
}: {
  defaultValue?: string[];
  invalid?: boolean;
  describedBy?: string;
}) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function commit() {
    const parts = draft
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setTags((t) => [...t, ...parts.filter((p) => !t.includes(p))]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      setTags((t) => t.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "bg-card focus-within:border-ring focus-within:ring-ring/50 flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-3",
        invalid && "border-destructive",
      )}
    >
      {tags.map((t, i) => (
        <span
          key={t}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-full pr-1 pl-3 text-[13px] font-medium",
            i === 0 ? "bg-primary text-primary-foreground" : "bg-track",
          )}
        >
          {t}
          <input type="hidden" name="meanings" value={t} />
          <button
            type="button"
            aria-label={`Remove meaning ${t}`}
            onClick={() => setTags((list) => list.filter((x) => x !== t))}
            className="inline-flex size-6 items-center justify-center rounded-full hover:bg-black/10"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        id="meaningDraft"
        name="meaningDraft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={tags.length ? "Add another meaning" : "e.g. to eat"}
        autoComplete="off"
        autoCapitalize="none"
        className="h-8 min-w-32 flex-1 bg-transparent px-1 text-[15px] outline-none"
      />
    </div>
  );
}
