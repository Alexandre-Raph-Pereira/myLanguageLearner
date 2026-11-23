import { pgEnum } from "drizzle-orm/pg-core";

/** Shared by words and grammar (plan 02). `suggested` = waiting in a review queue (plan 06). */
export const CONTENT_STATUSES = ["active", "suggested"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const contentStatus = pgEnum("content_status", CONTENT_STATUSES);

export const CONTENT_SOURCES = [
  "manual",
  "import_csv",
  "import_text",
  "import_photo",
  "topik_lookup",
  "alignment",
] as const;
export type ContentSource = (typeof CONTENT_SOURCES)[number];
export const contentSource = pgEnum("content_source", CONTENT_SOURCES);
