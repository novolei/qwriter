import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrandTagline } from "./BrandTagline";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("rotates slowly and pauses when the brand area is engaged or rotation is disabled", () => {
  vi.useFakeTimers();
  const { rerender } = render(<BrandTagline enabled paused={false} />);
  expect(screen.getByText("每一个想法，都值得留下")).toBeTruthy();
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.getByText("让文字，成为灵感的归处")).toBeTruthy();
  rerender(<BrandTagline enabled paused />);
  act(() => vi.advanceTimersByTime(16000));
  expect(screen.getByText("让文字，成为灵感的归处")).toBeTruthy();
  rerender(<BrandTagline enabled={false} paused={false} />);
  act(() => vi.advanceTimersByTime(16000));
  expect(screen.getByText("让文字，成为灵感的归处")).toBeTruthy();
});
