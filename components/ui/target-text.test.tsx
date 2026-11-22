// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { T } from "./target-text";

afterEach(cleanup);

it("sets lang and the target font class", () => {
  render(
    <T lang="ko" className="text-lg">
      한국어
    </T>,
  );
  const el = screen.getByText("한국어");
  expect(el).toHaveAttribute("lang", "ko");
  expect(el).toHaveClass("font-target-ko", "text-lg");
});
