/**
 * Text normalization helpers. Every Korean string is NFC-normalized before it is
 * stored or compared (macOS / some IMEs produce NFD Hangul).
 */

/** NFC, trimmed, inner whitespace collapsed to one space. Use before storing any text. */
export function clean(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** `clean`, or null when the result is empty. */
export function cleanOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const v = clean(s);
  return v === "" ? null : v;
}

const QUOTES = `"'“”‘’«»「」『』`;
const EDGE_QUOTES = new RegExp(`^[${QUOTES}]+|[${QUOTES}]+$`, "g");
const TRAILING_PUNCT = /[.?!~。？！～…]+$/;

/** Korean answer key: NFC, no whitespace at all, no trailing `.?!~`, no surrounding quotes. */
export function normKo(s: string): string {
  let v = s.normalize("NFC").replace(/\s+/g, "").replace(EDGE_QUOTES, "");
  let prev: string;
  do {
    prev = v;
    v = v.replace(TRAILING_PUNCT, "").replace(EDGE_QUOTES, "");
  } while (v !== prev);
  return v;
}

/**
 * English answer key: NFC, lowercase, punctuation removed (apostrophes and hyphens kept),
 * spaces collapsed, leading "to " and articles ("a", "an", "the") stripped.
 */
export function normEn(s: string): string {
  let v = s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  v = v.replace(/^to /, "");
  v = v.replace(/^(a|an|the) /, "");
  return v.trim();
}

/** Uniqueness key of a word's primary meaning (meanings are in the native language). */
export function meaningKey(primaryMeaning: string): string {
  return normEn(primaryMeaning);
}
