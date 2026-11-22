import { T } from "@/components/ui/target-text";
import { LANGUAGE_LABELS, type Language } from "@/lib/languages";

/** Header chip with the active language's native name (e.g. 한국어). */
export function LanguageIndicator({ language }: { language: Language }) {
  const label = LANGUAGE_LABELS[language];
  return (
    <span
      title={`Learning ${label.english}`}
      aria-label={`Learning ${label.english}`}
      className="bg-track text-foreground inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold"
    >
      <T lang={language}>{label.native}</T>
    </span>
  );
}
