"use client";

import dynamic from "next/dynamic";

/** Client-only (drafts are restored from sessionStorage on first render, no hydration mismatch). */
export const GrammarImportClient = dynamic(
  () => import("./grammar-import").then((m) => m.GrammarImport),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground text-[15px]">Loading…</p>,
  },
);
