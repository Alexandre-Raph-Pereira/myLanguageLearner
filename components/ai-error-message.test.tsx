// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiErrorMessage } from "./ai-error-message";

afterEach(cleanup);

describe("<AiErrorMessage>", () => {
  it("links budget errors to settings", () => {
    render(<AiErrorMessage error={{ kind: "budget", message: "Monthly AI budget reached" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Monthly AI budget reached");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/settings#budgets");
  });

  it("renders plain AI errors without a link", () => {
    render(<AiErrorMessage error={{ kind: "ai", message: "Failed" }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing without an error", () => {
    const { container } = render(<AiErrorMessage error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

it("uses the wrong-answer tokens", () => {
  render(<AiErrorMessage error={{ kind: "ai", message: "Failed" }} />);
  expect(screen.getByRole("alert")).toHaveClass("bg-wrong-soft", "text-wrong-text");
  cleanup();
});
