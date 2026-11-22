/** ~40 Korean dev-seed words (pure data, also used by e2e to answer prompts). */
export type SeedWord = {
  term: string;
  meanings: string[];
  type:
    | "noun"
    | "verb"
    | "adjective"
    | "adverb"
    | "pronoun"
    | "numeral"
    | "determiner"
    | "particle"
    | "counter"
    | "interjection"
    | "expression"
    | "other";
  example?: [string, string];
  level: 0 | 1 | 2 | 3;
  /** Days from now until due (negative = overdue). */
  dueInDays: number;
};

export const SEED_WORDS: SeedWord[] = [
  { term: "사과", meanings: ["apple"], type: "noun", example: ["사과를 하나 먹었어요.", "I ate an apple."], level: 0, dueInDays: 0 },
  { term: "학교", meanings: ["school"], type: "noun", example: ["학교에 가요.", "I go to school."], level: 1, dueInDays: -1 },
  { term: "친구", meanings: ["friend"], type: "noun", example: ["친구를 만났어요.", "I met a friend."], level: 2, dueInDays: -2 },
  { term: "물", meanings: ["water"], type: "noun", example: ["물 좀 주세요.", "Please give me some water."], level: 3, dueInDays: 10 },
  { term: "책", meanings: ["book"], type: "noun", example: ["책을 읽어요.", "I read a book."], level: 2, dueInDays: 2 },
  { term: "시간", meanings: ["time", "hour"], type: "noun", example: ["시간이 없어요.", "I have no time."], level: 1, dueInDays: 0 },
  { term: "음식", meanings: ["food"], type: "noun", level: 0, dueInDays: 0 },
  { term: "날씨", meanings: ["weather"], type: "noun", example: ["오늘 날씨가 좋아요.", "The weather is nice today."], level: 1, dueInDays: 1 },
  { term: "가족", meanings: ["family"], type: "noun", example: ["가족이 몇 명이에요?", "How many people are in your family?"], level: 3, dueInDays: 25 },
  { term: "배", meanings: ["pear"], type: "noun", example: ["배가 달아요.", "The pear is sweet."], level: 0, dueInDays: -3 },
  { term: "배", meanings: ["boat", "ship"], type: "noun", example: ["배를 타요.", "I take a boat."], level: 1, dueInDays: -1 },
  { term: "먹다", meanings: ["to eat"], type: "verb", example: ["밥을 먹어요.", "I eat rice."], level: 2, dueInDays: -1 },
  { term: "마시다", meanings: ["to drink"], type: "verb", example: ["커피를 마셔요.", "I drink coffee."], level: 1, dueInDays: 0 },
  { term: "가다", meanings: ["to go"], type: "verb", example: ["집에 가요.", "I go home."], level: 3, dueInDays: 14 },
  { term: "오다", meanings: ["to come"], type: "verb", example: ["친구가 와요.", "A friend is coming."], level: 2, dueInDays: 3 },
  { term: "공부하다", meanings: ["to study"], type: "verb", example: ["한국어를 공부해요.", "I study Korean."], level: 0, dueInDays: 0 },
  { term: "읽다", meanings: ["to read"], type: "verb", level: 0, dueInDays: 0 },
  { term: "배우다", meanings: ["to learn"], type: "verb", example: ["피아노를 배워요.", "I learn the piano."], level: 1, dueInDays: -2 },
  { term: "드시다", meanings: ["to eat (honorific)", "to eat"], type: "verb", example: ["할머니께서 진지를 드세요.", "Grandmother is eating."], level: 0, dueInDays: 0 },
  { term: "만나다", meanings: ["to meet"], type: "verb", example: ["내일 만나요.", "See you tomorrow."], level: 2, dueInDays: -1 },
  { term: "크다", meanings: ["big", "to be big"], type: "adjective", example: ["집이 커요.", "The house is big."], level: 1, dueInDays: 0 },
  { term: "작다", meanings: ["small", "to be small"], type: "adjective", example: ["방이 작아요.", "The room is small."], level: 0, dueInDays: 0 },
  { term: "맛있다", meanings: ["delicious", "tasty"], type: "adjective", example: ["이 음식은 맛있어요.", "This food is delicious."], level: 3, dueInDays: 40 },
  { term: "바쁘다", meanings: ["busy", "to be busy"], type: "adjective", level: 1, dueInDays: -1 },
  { term: "춥다", meanings: ["cold", "to be cold"], type: "adjective", example: ["겨울은 추워요.", "Winter is cold."], level: 2, dueInDays: 1 },
  { term: "예쁘다", meanings: ["pretty"], type: "adjective", example: ["꽃이 예뻐요.", "The flower is pretty."], level: 0, dueInDays: 0 },
  { term: "빨리", meanings: ["quickly", "fast"], type: "adverb", example: ["빨리 오세요.", "Please come quickly."], level: 1, dueInDays: 0 },
  { term: "아주", meanings: ["very"], type: "adverb", example: ["아주 좋아요.", "It's very good."], level: 3, dueInDays: 60 },
  { term: "자주", meanings: ["often"], type: "adverb", level: 0, dueInDays: 0 },
  { term: "같이", meanings: ["together"], type: "adverb", example: ["같이 가요.", "Let's go together."], level: 2, dueInDays: -2 },
  { term: "저", meanings: ["I (humble)", "I"], type: "pronoun", example: ["저는 학생이에요.", "I am a student."], level: 3, dueInDays: 7 },
  { term: "우리", meanings: ["we", "us", "our"], type: "pronoun", example: ["우리 집에 와요.", "Come to our house."], level: 2, dueInDays: 0 },
  { term: "하나", meanings: ["one"], type: "numeral", example: ["하나, 둘, 셋.", "One, two, three."], level: 3, dueInDays: 30 },
  { term: "셋", meanings: ["three"], type: "numeral", level: 1, dueInDays: 0 },
  { term: "이", meanings: ["this"], type: "determiner", example: ["이 책은 재미있어요.", "This book is interesting."], level: 2, dueInDays: 0 },
  { term: "개", meanings: ["item counter", "piece"], type: "counter", example: ["사과 세 개 주세요.", "Three apples, please."], level: 1, dueInDays: -1 },
  { term: "명", meanings: ["person counter", "people"], type: "counter", example: ["학생이 다섯 명 있어요.", "There are five students."], level: 0, dueInDays: 0 },
  { term: "은/는", meanings: ["topic particle"], type: "particle", example: ["저는 학생이에요.", "I am a student."], level: 2, dueInDays: 5 },
  { term: "아이고", meanings: ["oh my", "oh no"], type: "interjection", example: ["아이고, 힘들어요.", "Oh my, it's hard."], level: 0, dueInDays: 0 },
  { term: "감사합니다", meanings: ["thank you"], type: "expression", example: ["도와주셔서 감사합니다.", "Thank you for helping."], level: 3, dueInDays: 90 },
  { term: "잘 지내요", meanings: ["I'm doing well", "how are you"], type: "expression", level: 1, dueInDays: 0 },
];
