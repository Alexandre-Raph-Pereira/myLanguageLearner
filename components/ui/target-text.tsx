import type { ComponentProps } from "react";
import { TARGET_FONT_CLASS, type Language } from "@/lib/languages";
import { cn } from "@/lib/utils";

/** Target-language text: sets `lang` and the language's font slot. */
export function T({
  lang,
  className,
  ...props
}: Omit<ComponentProps<"span">, "lang"> & { lang: Language }) {
  return <span lang={lang} className={cn(TARGET_FONT_CLASS[lang], className)} {...props} />;
}
