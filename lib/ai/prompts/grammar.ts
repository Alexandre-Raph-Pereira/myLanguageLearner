import { LANGUAGE_LABELS, type Language } from "@/lib/languages";

export type PromptLesson = { code: string; title: string; meaningShort: string };

export type GrammarPromptCtx = {
  language: Language;
  /** Learner's native language (explanations, translations). */
  nativeLanguage: string;
  /** Target exam level 1–6, or null. */
  targetLevel: number | null;
};

const FIELDS = [
  "Each lesson has these fields:",
  "- `title`: the grammar point as learners write it, e.g. `-(으)ㄹ 수 있다`.",
  "- `pattern`: canonical form (usually the same as the title).",
  "- `variants`: every surface form a learner will meet (consonant / vowel stem forms, 하다 form, common negative / past forms), each starting with `-` when it attaches to a stem.",
  "- `meaning_short`: one short line in the native language.",
  "- `level`: estimated exam level 1–6, or null when unsure.",
  "- `description_md`: when and why it is used (markdown, concise, learner-friendly).",
  "- `formation_md`: how it attaches (consonant / vowel stems, irregulars, tense), as a short markdown list.",
  "- `examples`: at least 3 `{ sentence, translation }` pairs; `sentence` in the target language, `translation` in the native language.",
  "- `similar_md`: similar expressions and what to be careful about (markdown, may be empty).",
  "- `related`: links to the learner's existing lessons, `{ ref, kind, note }`, `kind` = similar | contrast | prerequisite.",
].join("\n");

function header(ctx: GrammarPromptCtx): string[] {
  const target = LANGUAGE_LABELS[ctx.language].english;
  const level = ctx.targetLevel ? ` The learner aims for TOPIK level ${ctx.targetLevel}.` : "";
  return [
    `You are an expert ${target} teacher writing grammar lessons for a learner whose native language is ${ctx.nativeLanguage}.${level}`,
    `Write explanations, meanings and translations in ${ctx.nativeLanguage}; write ${target} in Unicode NFC.`,
  ];
}

function lessonList(lessons: PromptLesson[]): string {
  if (lessons.length === 0)
    return "The learner has no lessons yet: `related` must be an empty list.";
  return [
    "The learner's existing lessons (code: title — meaning). Use ONLY these codes in `related`:",
    ...lessons.map((l) => `${l.code}: ${l.title} — ${l.meaningShort}`),
  ].join("\n");
}

/** Task `grammar.structure` (smart tier): notes text or one notebook photo → lesson drafts. */
export function grammarStructurePrompt(
  ctx: GrammarPromptCtx,
  lessons: PromptLesson[],
  input: { notes?: string; image?: boolean },
): { system: string; prompt: string } {
  const system = [
    ...header(ctx),
    "You turn the learner's own notes (typed text or a photo of a notebook page) into structured grammar lessons.",
    "Rules:",
    "- One draft per grammar point; a page may contain several. Ignore vocabulary lists and unrelated text. If there is no grammar point, return an empty list.",
    "- Keep the learner's explanations and examples; correct obvious mistakes; complete every missing section (description, formation, at least 3 examples with translations, similar / be careful).",
    "- Be concise. No greetings, no commentary outside the fields.",
    "- `related`: only codes from the list below, only when the link is genuinely useful; never invent codes. Do not link a draft to a lesson with the same pattern.",
    "",
    FIELDS,
    "",
    lessonList(lessons),
  ].join("\n");
  const prompt = input.image
    ? "Structure the grammar lesson(s) written on this notebook page."
    : `Structure the grammar lesson(s) in these notes:\n\n<notes>\n${input.notes ?? ""}\n</notes>`;
  return { system, prompt };
}

/** Task `grammar.rewrite` (smart tier): one draft + optional instruction → one draft. */
export function grammarRewritePrompt(
  ctx: GrammarPromptCtx,
  draftJson: string,
  instruction: string | null,
): { system: string; prompt: string } {
  const system = [
    ...header(ctx),
    "You revise one grammar lesson draft that the learner may have edited by hand.",
    "Rules:",
    "- Change only what the instruction asks. Keep the learner's edits and every other field as they are unless the instruction says otherwise.",
    "- Without an instruction: fix mistakes and complete missing sections (at least 3 examples), keep everything else.",
    "- Keep `related` exactly as given.",
    "",
    FIELDS,
  ].join("\n");
  const prompt = [
    `Current draft (JSON):\n${draftJson}`,
    instruction
      ? `Instruction: ${instruction}`
      : "Instruction: (none) — improve and complete the draft.",
  ].join("\n\n");
  return { system, prompt };
}
