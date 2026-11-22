import Link from "next/link";
import type { AiErrorPayload } from "@/lib/ai/errors";

/** Shows an AI-layer error; budget errors link to Settings. */
export function AiErrorMessage({ error }: { error: AiErrorPayload | null | undefined }) {
  if (!error) return null;
  return (
    <div role="alert" className="bg-wrong-soft text-wrong-text rounded-xl p-3 text-sm">
      <p>{error.message}</p>
      {error.kind === "budget" && (
        <Link href="/settings#budgets" className="mt-1 inline-block font-medium underline">
          Open budget settings
        </Link>
      )}
    </div>
  );
}
