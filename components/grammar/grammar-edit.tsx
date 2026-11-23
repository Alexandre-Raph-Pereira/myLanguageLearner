"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GrammarCostInfo } from "@/lib/grammar/cost";
import type { ReviewDraft } from "@/lib/grammar/schema";
import type { Language } from "@/lib/languages";
import type { LessonOption } from "./draft-fields";
import { GrammarDraftReview, type ReviewItem } from "./draft-review";

/** `/grammar/[id]/edit`: the review form for one existing lesson (Save updates it). */
export function GrammarEdit({
  lessonId,
  draft,
  language,
  exam,
  lessons,
  cost,
}: {
  lessonId: string;
  draft: ReviewDraft;
  language: Language;
  exam: string;
  lessons: LessonOption[];
  cost: GrammarCostInfo;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>([
    { key: lessonId, draft, previous: null, source: "manual", lessonId },
  ]);
  return (
    <GrammarDraftReview
      items={items}
      onItemsChange={setItems}
      lessons={lessons}
      language={language}
      exam={exam}
      cost={cost}
      discardLabel="Cancel"
      onDiscard={() => router.push(`/grammar/${lessonId}`)}
      onSaved={(l) => router.push(`/grammar/${l.id}`)}
    />
  );
}
