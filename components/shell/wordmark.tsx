import Link from "next/link";
import { cn } from "@/lib/utils";

/** "LangLearner" in Fraunces 700 followed by the brass dot. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="LangLearner home"
      className={cn("font-display inline-flex items-baseline gap-1 text-xl font-bold", className)}
    >
      LangLearner
      <span aria-hidden className="bg-brass inline-block size-1.5 rounded-full" />
    </Link>
  );
}
