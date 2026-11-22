import { describe, expect, it } from "vitest";
import { checkAnswer, normTarget, type CheckableWord } from "./answer";

const eat: CheckableWord = { id: "1", term: "먹다", meanings: ["to eat", "to consume"] };
const study: CheckableWord = { id: "2", term: "공부하다", meanings: ["to study"] };
const pear: CheckableWord = { id: "3", term: "배", meanings: ["pear"] };
const boat: CheckableWord = { id: "4", term: "배", meanings: ["boat", "ship"] };
const eatHon: CheckableWord = { id: "5", term: "드시다", meanings: ["to eat (honorific)", "eat"] };
const bank = [eat, study, pear, boat, eatHon];

describe("checkAnswer en_ko", () => {
  it("accepts exact, NFD, spaced and punctuated answers", () => {
    expect(checkAnswer({ word: eat, direction: "en_ko", answer: "먹다" }).result).toBe("correct");
    expect(
      checkAnswer({ word: eat, direction: "en_ko", answer: "먹다".normalize("NFD") }).result,
    ).toBe("correct");
    expect(checkAnswer({ word: study, direction: "en_ko", answer: "공부 하다" }).result).toBe(
      "correct",
    );
    expect(checkAnswer({ word: eat, direction: "en_ko", answer: " 먹다. " }).result).toBe(
      "correct",
    );
  });

  it("another bank word with a shared meaning is an alternative", () => {
    expect(checkAnswer({ word: eat, direction: "en_ko", answer: "드시다", bank })).toEqual({
      result: "alternative",
      alternativeId: "5",
    });
  });

  it("a bank word without a shared meaning is wrong (homonyms)", () => {
    expect(checkAnswer({ word: eat, direction: "en_ko", answer: "배", bank }).result).toBe("wrong");
    expect(checkAnswer({ word: pear, direction: "en_ko", answer: "배", bank }).result).toBe(
      "correct",
    );
  });

  it("empty and wrong answers are wrong", () => {
    expect(checkAnswer({ word: eat, direction: "en_ko", answer: "  " }).result).toBe("wrong");
    expect(checkAnswer({ word: eat, direction: "en_ko", answer: "마시다", bank }).result).toBe(
      "wrong",
    );
  });
});

describe("checkAnswer ko_en", () => {
  it("accepts any meaning, with or without 'to' / articles / case", () => {
    expect(checkAnswer({ word: eat, direction: "ko_en", answer: "eat" }).result).toBe("correct");
    expect(checkAnswer({ word: eat, direction: "ko_en", answer: "To Consume." }).result).toBe(
      "correct",
    );
    expect(checkAnswer({ word: pear, direction: "ko_en", answer: "the pear" }).result).toBe(
      "correct",
    );
  });

  it("homonym meanings belong to their own word", () => {
    expect(checkAnswer({ word: pear, direction: "ko_en", answer: "boat", bank }).result).toBe(
      "wrong",
    );
    expect(checkAnswer({ word: pear, direction: "ko_en", answer: "" }).result).toBe("wrong");
  });
});

describe("normTarget", () => {
  it("uses normKo for Korean and normEn otherwise", () => {
    expect(normTarget("ko", "공부 하다")).toBe("공부하다");
    expect(normTarget("fr", "Le Livre")).toBe("le livre");
  });
  it("works for latin target languages", () => {
    const livre = { id: "9", term: "livre", meanings: ["book"] };
    expect(
      checkAnswer({ word: livre, direction: "en_ko", answer: "Livre", language: "fr" }).result,
    ).toBe("correct");
  });
});
