import { BookOpen, ClipboardCheck, Languages, type LucideIcon } from "lucide-react";

export type TestEntry = {
  id: "words" | "grammar" | "topik";
  title: string;
  description: string;
  /** Plan that ships it — the card is disabled until then. */
  plan: string;
  icon: LucideIcon;
};

/** The three test types of the app (VISION.md). */
export const TEST_ENTRIES: TestEntry[] = [
  {
    id: "words",
    title: "Word test",
    description: "25 due words, spaced repetition. EN→KR by default.",
    plan: "01",
    icon: Languages,
  },
  {
    id: "grammar",
    title: "Grammar test",
    description: "5–20 questions on the lessons you pick.",
    plan: "03",
    icon: BookOpen,
  },
  {
    id: "topik",
    title: "TOPIK test",
    description: "Blank or serious mode at your target level.",
    plan: "05",
    icon: ClipboardCheck,
  },
];
