---
name: words-suggest-types
description: Guidance for the myLanguageLearner task words.suggest_types — choosing the part of speech of imported vocabulary items. Guidance only; the app's task instructions define the output fields.
---

# Suggesting word types

Guidance only: return exactly the fields requested by the app, one answer per item.

## How to decide
- Decide from the **dictionary form** and the learner's meaning together. The meaning
  tells which sense the learner wrote down (배 = pear / ship / belly: all nouns).
- **noun**: things, people, places, abstract ideas, Sino-Korean nouns (공부, 운동, 사랑)
  when written without 하다.
- **verb**: action verbs ending in 다 (가다, 먹다), **하다 verbs** (공부하다, 운동하다),
  passive / causative verbs (보이다, 먹이다), 되다 verbs.
- **adjective**: Korean descriptive verbs (크다, 예쁘다, 맛있다, 조용하다, 필요하다). The
  English meaning "to be big" or "big" both mean adjective.
- **adverb**: 빨리, 아주, 같이, 자주, -게 / -히 forms used as adverbs (천천히, 조용히).
- **expression**: multi-word phrases, set expressions, greetings and idioms
  (잘 먹겠습니다, 수고하세요, 눈이 높다), and grammar-like chunks written as a whole.
- Other types the app allows, only when the item clearly is one: **counter** (개, 명, 마리,
  권), **particle** (은/는, 에서, 부터), **pronoun** (저, 우리, 이것), **numeral** (하나, 일,
  첫째), **determiner** (이/그/저 before a noun, 새, 헌, 모든), **interjection** (아, 어머,
  네, 아니요 used alone).

## Tricky cases
- Same root, different entries: 공부 (noun) vs 공부하다 (verb); 조용 alone is rare, 조용하다
  is an adjective. Follow the form actually written.
- 있다 / 없다: verb unless the meaning is clearly "interesting/fun" style adjective
  compounds (재미있다, 맛있다 → adjective).
- 이다 / 아니다: `other` unless the app lists a better fit.
- Native numbers vs Sino-Korean numbers are both `numeral`; 한/두/세 before a counter are
  `numeral` too.
- A conjugated form (먹어요, 예뻐서): classify by its dictionary form.
- When you are genuinely unsure, answer `other` — the learner will fix it. Never guess
  wildly and never add or drop items.
