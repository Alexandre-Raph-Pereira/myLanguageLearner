import Markdown from "react-markdown";
import { cn } from "@/lib/utils";

/** Lesson markdown (description, formation, similar): no raw HTML, token colours only. */
export function LessonMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 text-[15px] leading-relaxed",
        "[&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_em]:italic [&_strong]:font-semibold",
        "[&_code]:bg-track [&_code]:rounded-sm [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[14px]",
        "[&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h1]:text-xl [&_h1]:font-medium [&_h2]:text-lg [&_h2]:font-medium [&_h3]:text-base [&_h3]:font-semibold",
        "[&_blockquote]:border-border-strong [&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
        "[&_a]:text-brass-text [&_a]:underline",
        "[&_table]:w-full [&_table]:text-[14px] [&_td]:border-t [&_td]:py-1 [&_td]:pr-2 [&_th]:py-1 [&_th]:pr-2 [&_th]:text-left",
        className,
      )}
    >
      <Markdown skipHtml>{children}</Markdown>
    </div>
  );
}
