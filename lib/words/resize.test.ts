import { describe, expect, it } from "vitest";
import { fitWithin } from "./resize";

describe("fitWithin", () => {
  it("scales the long side down to 2000 px and never upscales", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
