/**
 * Parser for hand-written grammar lesson files (`content/grammar/<lang>/*.md`, format in
 * `content/grammar/TEMPLATE.md`). Lets the owner add lessons without any AI call; plan 02
 * imports the result into `grammar_points` / `grammar_links`.
 */
import { z } from "zod";
import { clean } from "@/lib/text/normalize";

export const LINK_KINDS = ["similar", "contrast", "prerequisite"] as const;

export const lessonFileSchema = z.object({
  title: z.string().min(1),
  pattern: z.string().min(1),
  variants: z.array(z.string().min(1)).min(1),
  meaningShort: z.string().min(1),
  level: z.number().int().min(1).max(6).nullable(),
  descriptionMd: z.string().min(1),
  formationMd: z.string().min(1),
  examples: z
    .array(z.object({ ko: z.string().min(1), en: z.string().min(1), use: z.string().optional() }))
    .min(2),
  similarMd: z.string(),
  related: z.array(
    z.object({ pattern: z.string().min(1), kind: z.enum(LINK_KINDS), note: z.string().optional() }),
  ),
});

export type LessonFile = z.infer<typeof lessonFileSchema>;

export class LessonFileError extends Error {}

const SECTIONS = {
  description: "description",
  formation: "formation",
  examples: "examples",
  "similar · be careful": "similar",
  related: "related",
} as const;
type SectionKey = (typeof SECTIONS)[keyof typeof SECTIONS];

/** NFC + trim every line, keep line breaks (Markdown needs them). */
function nfcBlock(s: string): string {
  return s
    .normalize("NFC")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

function parseHeader(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    if (i < 0) throw new LessonFileError(`Header line without ":": ${line}`);
    out[line.slice(0, i).trim().toLowerCase()] = clean(line.slice(i + 1));
  }
  return out;
}

function splitSections(body: string): Partial<Record<SectionKey, string>> {
  const out: Partial<Record<SectionKey, string>> = {};
  let current: SectionKey | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current) out[current] = nfcBlock(buf.join("\n"));
  };
  for (const line of body.split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      flush();
      const key = SECTIONS[h[1].toLowerCase() as keyof typeof SECTIONS];
      if (!key) throw new LessonFileError(`Unknown section "## ${h[1]}"`);
      if (out[key] !== undefined) throw new LessonFileError(`Duplicate section "## ${h[1]}"`);
      current = key;
      buf = [];
    } else if (current) {
      buf.push(line);
    } else if (line.trim()) {
      throw new LessonFileError(`Text before the first section: ${line}`);
    }
  }
  flush();
  return out;
}

const stripBold = (s: string) => clean(s.replace(/\*\*/g, ""));

function parseExamples(md: string): LessonFile["examples"] {
  const rows = md
    .split("\n")
    .filter((l) => l.trim().startsWith("|"))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
  // rows[0] = header, rows[1] = |---| separator
  return rows.slice(2).map((cells, i) => {
    if (cells.length !== 3) throw new LessonFileError(`Example row ${i + 1} needs 3 columns`);
    const [use, ko, en] = cells;
    return { ...(use ? { use: clean(use) } : {}), ko: stripBold(ko), en: stripBold(en) };
  });
}

function parseRelated(md: string): LessonFile["related"] {
  return md
    .split("\n")
    .filter((l) => l.trim().startsWith("-"))
    .map((l) => {
      // The note needs a space before "(" so patterns like -(으)려고 keep their parentheses.
      const m = /^-\s*(\w+)\s*:\s*(.+?)(?:\s+\((.+)\))?$/.exec(l.trim());
      if (!m) throw new LessonFileError(`Related line not understood: ${l}`);
      const kind = m[1].toLowerCase();
      if (!(LINK_KINDS as readonly string[]).includes(kind))
        throw new LessonFileError(`Related kind must be ${LINK_KINDS.join(" | ")}: ${l}`);
      return {
        kind: kind as LessonFile["related"][number]["kind"],
        pattern: clean(m[2]),
        ...(m[3] ? { note: clean(m[3]) } : {}),
      };
    });
}

/** Parse one lesson file. Throws `LessonFileError` (format) or a zod error (missing data). */
export function parseLessonFile(source: string): LessonFile {
  const text = source
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "");
  const fm = /^\s*---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!fm) throw new LessonFileError("Missing header between --- lines");
  const h = parseHeader(fm[1]);
  const s = splitSections(fm[2]);

  const level = h.level ? Number(h.level) : null;
  return lessonFileSchema.parse({
    title: h.title,
    pattern: h.pattern,
    variants: (h.variants ?? "").split(",").map(clean).filter(Boolean),
    meaningShort: h.meaning,
    level: Number.isNaN(level) ? h.level : level,
    descriptionMd: s.description,
    formationMd: s.formation,
    examples: parseExamples(s.examples ?? ""),
    similarMd: s.similar ?? "",
    related: parseRelated(s.related ?? ""),
  });
}
