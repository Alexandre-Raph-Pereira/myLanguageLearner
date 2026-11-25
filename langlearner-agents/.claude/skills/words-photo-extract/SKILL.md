---
name: words-photo-extract
description: Guidance for the myLanguageLearner task words.photo_extract — transcribing a photo of the learner's handwritten vocabulary notebook. Guidance only; the app's task instructions define the output fields.
---

# Reading a vocabulary notebook photo

Guidance only: return exactly the fields requested by the app.

## Read literally
- Transcribe what is **written**, character by character. Never "fix" a word into a
  different, more common word (e.g. do not turn 낳다 into 놓다, or 빗 into 빛), even if
  you think the learner made a mistake.
- Obvious slips inside a word that are clearly the same word may be kept as written and
  marked low confidence — the learner decides.
- Handwritten Hangul: check final consonants carefully (ㄴ/ㄹ/ㅁ/ㅇ, ㅂ/ㅍ, ㅈ/ㅊ), double
  consonants (ㄲ, ㅆ) and vowels that look alike (ㅓ/ㅕ, ㅗ/ㅛ, ㅐ/ㅔ).

## Confidence
- Lower the confidence whenever you hesitate between two readings, part of the word is
  hidden, blurred or cut by the page edge, or the form is conjugated.
- High confidence only when you would bet on the exact spelling.

## Keep the learner's meaning
- Copy the learner's meaning text as written (their language, their words), splitting
  several meanings into separate strings. Don't replace it by a dictionary definition.
- Keep example sentences only when they are written next to the word.

## Ignore
- Crossed-out or scribbled-over text, page numbers, dates, titles, doodles, printed
  notebook decorations, and text from the facing page if it is only partly visible.
- Arrows and brackets linking items: keep the items, not the marks.

## Layout
- Notebooks are often two columns (word | meaning) or word — meaning lines. Follow the
  learner's layout; one entry per vocabulary item, in reading order.
