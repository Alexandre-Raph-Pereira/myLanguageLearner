"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { TARGET_FONT_CLASS, type Language } from "@/lib/languages";
import { cn } from "@/lib/utils";

/**
 * Controlled tag input (variants): Enter / comma / semicolon adds a tag, Backspace on an
 * empty input removes the last one. Enter is ignored while an IME is composing (Korean).
 */
export function TagInput({
  id,
  value,
  onChange,
  language,
  placeholder,
  label,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  language?: Language;
  placeholder?: string;
  /** Accessible name of the text input and remove buttons. */
  label: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const parts = draft
      .split(/[;,]/)
      .map((p) => p.normalize("NFC").trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    onChange([...value, ...parts.filter((p, i) => !value.includes(p) && parts.indexOf(p) === i)]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const font = language ? TARGET_FONT_CLASS[language] : undefined;
  return (
    <div className="bg-card focus-within:border-ring focus-within:ring-ring/50 flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-3">
      {value.map((t) => (
        <span
          key={t}
          className="bg-track inline-flex h-8 items-center gap-1 rounded-full pr-1 pl-3 text-[14px]"
        >
          <span lang={language} className={font}>
            {t}
          </span>
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="inline-flex size-6 items-center justify-center rounded-full hover:bg-black/10"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        lang={language}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        className={cn("h-8 min-w-32 flex-1 bg-transparent px-1 text-[15px] outline-none", font)}
      />
    </div>
  );
}
