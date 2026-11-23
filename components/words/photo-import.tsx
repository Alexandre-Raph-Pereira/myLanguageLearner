"use client";

import { Camera, ImagePlus } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { AiErrorMessage } from "@/components/ai-error-message";
import { ProgressBar } from "@/components/progress";
import { Button } from "@/components/ui/button";
import type { AiErrorPayload } from "@/lib/ai/errors";
import type { Language } from "@/lib/languages";
import { entriesToRows, type ImportRow } from "@/lib/words/import";
import { resizeImage } from "@/lib/words/resize";
import { ImportReview } from "./import-review";

const MAX_PHOTOS = 5;

/** Up to 5 notebook photos → resized client-side → one request each → shared review. */
export function PhotoImport({ language }: { language: Language }) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<{ name: string; error: AiErrorPayload }[]>([]);
  const [rows, setRows] = useState<ImportRow[] | null>(null);

  function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    setFiles((list) => [...list, ...picked].slice(0, MAX_PHOTOS));
    e.target.value = "";
  }

  async function extract() {
    setErrors([]);
    setProgress({ done: 0, total: files.length });
    const all: ImportRow[] = [];
    const errs: { name: string; error: AiErrorPayload }[] = [];
    for (const [n, file] of files.entries()) {
      try {
        const blob = await resizeImage(file);
        const fd = new FormData();
        fd.append("image", blob, file.name.replace(/\.\w+$/, "") + ".jpg");
        const res = await fetch("/api/words/photo-extract", { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          errs.push({
            name: file.name,
            error: body.error ?? { kind: "ai", message: `Request failed (${res.status}).` },
          });
          if (body.error?.kind === "budget") break;
        } else {
          all.push(...entriesToRows(body.entries ?? [], all.length));
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
    if (all.length > 0) setRows(all);
  }

  if (rows) {
    return (
      <div className="flex flex-col gap-4">
        {errors.map((e) => (
          <div key={e.name} className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">{e.name}</span>
            <AiErrorMessage error={e.error} />
          </div>
        ))}
        <p className="text-muted-foreground text-[13px]">
          Check every row against your notebook — highlighted rows were hard to read or are written
          in a conjugated form.
        </p>
        <ImportReview rows={rows} setRows={setRows} language={language} source="import_photo" />
      </div>
    );
  }

  const busy = progress !== null;
  return (
    <div className="flex flex-col gap-5">
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
        Up to {MAX_PHOTOS} photos. They are resized on your phone, read by the AI one by one and
        never stored.
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

      <Button
        size="lg"
        className="md:self-start"
        disabled={busy || files.length === 0}
        onClick={extract}
      >
        {busy
          ? "Reading…"
          : `Read ${files.length || ""} ${files.length === 1 ? "photo" : "photos"}`}
      </Button>
    </div>
  );
}
