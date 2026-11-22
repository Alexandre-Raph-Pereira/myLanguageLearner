import { Badge } from "@/components/ui/badge";
import { LANGUAGE_LABELS, type Language } from "@/lib/languages";

export function LanguageIndicator({ language }: { language: Language }) {
  const label = LANGUAGE_LABELS[language];
  return (
    <Badge variant="secondary" title={`Learning ${label.english}`}>
      {label.native} · {label.english}
    </Badge>
  );
}
