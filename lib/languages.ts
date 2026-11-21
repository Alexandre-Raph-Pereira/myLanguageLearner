export const SUPPORTED_LANGUAGES = ["ko", "fr", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Languages usable in the UI today. */
export const ENABLED_LANGUAGES: readonly Language[] = ["ko"];

export const LANGUAGE_LABELS: Record<Language, { english: string; native: string }> = {
  ko: { english: "Korean", native: "한국어" },
  fr: { english: "French", native: "Français" },
  en: { english: "English", native: "English" },
};

/** Default exam per language (only Korean has one for now). */
export const LANGUAGE_EXAMS: Partial<Record<Language, string>> = { ko: "TOPIK" };

export function isLanguage(v: unknown): v is Language {
  return typeof v === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}
