import { describe, expect, test } from "vitest";
import { REVEAL_TRIGGER_MARGIN, shouldArmReveal } from "./scroll-reveal";

describe("shouldArmReveal", () => {
  const viewportHeight = 900;
  const triggerLine = viewportHeight * (1 - REVEAL_TRIGGER_MARGIN);

  test("never arms under reduced motion, even far below the fold", () => {
    expect(shouldArmReveal({ top: 5000, viewportHeight, reducedMotion: true })).toBe(false);
  });

  test("does not arm content that is already on screen at hydration", () => {
    expect(shouldArmReveal({ top: 0, viewportHeight, reducedMotion: false })).toBe(false);
    expect(shouldArmReveal({ top: triggerLine - 1, viewportHeight, reducedMotion: false })).toBe(false);
  });

  test("arms content still below the reveal trigger line", () => {
    expect(shouldArmReveal({ top: triggerLine, viewportHeight, reducedMotion: false })).toBe(true);
    expect(shouldArmReveal({ top: 2400, viewportHeight, reducedMotion: false })).toBe(true);
  });

  test("does not arm content scrolled past (above the viewport)", () => {
    expect(shouldArmReveal({ top: -600, viewportHeight, reducedMotion: false })).toBe(false);
  });
});
