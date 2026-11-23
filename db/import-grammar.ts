/* `pnpm grammar:import [--update]`: load content/grammar/<lang>/*.md into the owner's grammar library (no AI). */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { importLessonFiles } from "@/lib/grammar/import-files";
import { parseLessonFile, type LessonFile } from "@/lib/grammar/lesson-file";
import { isLanguage } from "@/lib/languages";
import { openScriptDb } from "./script-client";
import { redactUrl } from "./url";

const CONTENT = path.resolve(__dirname, "../content/grammar");

/** Parsed lesson files per language folder; a bad file stops everything (fix it, then re-run). */
export function readLessonFiles(root = CONTENT): Map<string, LessonFile[]> {
  const out = new Map<string, LessonFile[]>();
  for (const d of readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const files = readdirSync(path.join(root, d.name))
      .filter((f) => f.endsWith(".md"))
      .sort();
    out.set(
      d.name,
      files.map((f) => {
        try {
          return parseLessonFile(readFileSync(path.join(root, d.name, f), "utf8"));
        } catch (e) {
          throw new Error(`${d.name}/${f}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }),
    );
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const userId =
    process.env.GRAMMAR_IMPORT_USER_ID ?? process.env.NO_LOGIN_USER_ID ?? process.env.DEV_USER_ID;
  if (!userId) throw new Error("Set GRAMMAR_IMPORT_USER_ID (the owner's user id)");
  const update = process.argv.includes("--update");
  const byLang = readLessonFiles();
  console.log(`Importing into ${redactUrl(url)} for user ${userId}${update ? " (update)" : ""}`);
  const { db, close } = await openScriptDb(url);
  try {
    for (const [language, lessons] of byLang) {
      if (!isLanguage(language)) throw new Error(`Unknown language folder: ${language}`);
      const r = await importLessonFiles(db, { userId, language }, lessons, { update });
      console.log(
        `[${language}] created ${r.created.length}, updated ${r.updated.length}, skipped ${r.skipped.length} (already there), new links ${r.linksAdded}`,
      );
      for (const t of r.created) console.log(`  + ${t}`);
      for (const t of r.updated) console.log(`  ~ ${t}`);
      for (const t of r.skipped) console.log(`  = ${t}`);
      if (r.unresolved.length > 0) {
        console.log("  Related lessons not in the library yet (linked on a later run):");
        for (const u of r.unresolved) console.log(`    ${u}`);
      }
    }
  } finally {
    await close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
