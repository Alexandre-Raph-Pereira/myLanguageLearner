import { and, eq, inArray } from "drizzle-orm";
import { matchKeys } from "@/lib/grammar/normalize";
import { grammarLinks, grammarPoints, type GrammarExample } from "./schema/grammar";
import type { Db } from "./types";

type SeedLesson = {
  title: string;
  variants: string[];
  meaning: string;
  level: number;
  description: string;
  formation: string;
  examples: [string, string][];
  similar: string;
};

/** Three linked dev lessons (idempotent: skipped when the titles already exist). */
export const SEED_GRAMMAR: SeedLesson[] = [
  {
    title: "-아/어서",
    variants: ["-아서", "-어서", "-해서", "-서"],
    meaning: "because / and then (sequence)",
    level: 1,
    description:
      "Links two clauses. Either the first clause is the **reason** for the second, or the two actions happen **in sequence** and are closely connected (go *and then* do something there).",
    formation:
      "- Stem with **ㅏ / ㅗ** → **-아서**: 가다 → 가서\n- Other vowels → **-어서**: 먹다 → 먹어서\n- **하다** → **해서**\n- No past tense before -아/어서.",
    examples: [
      ["배가 고파서 밥을 먹었어요.", "I was hungry, so I ate."],
      ["학교에 가서 친구를 만났어요.", "I went to school and met a friend."],
      ["피곤해서 일찍 잤어요.", "I was tired, so I went to bed early."],
    ],
    similar: "Cannot be followed by a command or a suggestion (use **-(으)니까** instead).",
  },
  {
    title: "-(으)니까",
    variants: ["-니까", "-으니까"],
    meaning: "because (reason, also before commands)",
    level: 2,
    description:
      "Gives a reason, often one the listener may not know. Unlike -아/어서, it can be followed by commands and suggestions.",
    formation:
      "- Vowel stem or ㄹ stem → **-니까**: 가다 → 가니까, 살다 → 사니까\n- Consonant stem → **-으니까**: 먹다 → 먹으니까\n- Past: **-았/었으니까**",
    examples: [
      ["비가 오니까 우산을 가져가세요.", "It's raining, so take an umbrella."],
      ["시간이 없으니까 빨리 가요.", "We have no time, so let's go quickly."],
    ],
    similar: "",
  },
  {
    title: "-(으)ㄹ 수 있다",
    variants: ["-ㄹ 수 있다", "-을 수 있다", "-ㄹ 수 없다", "-을 수 없다"],
    meaning: "can / be able to",
    level: 1,
    description: "Expresses ability or possibility. The negative is **-(으)ㄹ 수 없다**.",
    formation:
      "- Vowel stem → **-ㄹ 수 있다**: 가다 → 갈 수 있다\n- Consonant stem → **-을 수 있다**: 먹다 → 먹을 수 있다\n- ㄹ stem: 만들다 → 만들 수 있다",
    examples: [
      ["저는 한국어를 할 수 있어요.", "I can speak Korean."],
      ["오늘은 갈 수 없어요.", "I can't go today."],
      ["매운 음식을 먹을 수 있어요?", "Can you eat spicy food?"],
    ],
    similar: "",
  },
];

export async function seedGrammar(db: Db, userId: string): Promise<number> {
  const titles = SEED_GRAMMAR.map((g) => g.title);
  const existing = await db
    .select({ id: grammarPoints.id })
    .from(grammarPoints)
    .where(and(eq(grammarPoints.userId, userId), inArray(grammarPoints.title, titles)));
  if (existing.length > 0) return 0;
  const rows = await db
    .insert(grammarPoints)
    .values(
      SEED_GRAMMAR.map((g) => ({
        userId,
        language: "ko",
        title: g.title,
        pattern: g.title,
        variants: g.variants,
        matchKeys: matchKeys({ pattern: g.title, variants: g.variants }),
        meaningShort: g.meaning,
        level: g.level,
        descriptionMd: g.description,
        formationMd: g.formation,
        examples: g.examples.map(([sentence, translation]): GrammarExample => ({
          sentence,
          translation,
        })),
        similarMd: g.similar,
      })),
    )
    .returning({ id: grammarPoints.id, title: grammarPoints.title });
  const id = (t: string) => rows.find((r) => r.title === t)!.id;
  const [a, b] = [id("-아/어서"), id("-(으)니까")];
  const note = "-(으)니까 works before commands";
  await db.insert(grammarLinks).values([
    { userId, grammarId: a, relatedId: b, kind: "contrast", note },
    { userId, grammarId: b, relatedId: a, kind: "contrast", note },
  ]);
  return rows.length;
}
