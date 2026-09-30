import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token --color-${name} not found`);
  return match[1];
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("small-text colour tokens meet WCAG AA (4.5:1) on the backgrounds they are used on", () => {
  for (const text of ["ink", "ink-soft", "ink-faint"]) {
    for (const background of ["canvas", "surface"]) {
      test(`${text} on ${background}`, () => {
        expect(contrast(token(text), token(background))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  test("ink-faint stays lighter than ink-soft, preserving the text hierarchy", () => {
    expect(luminance(token("ink-faint"))).toBeGreaterThan(luminance(token("ink-soft")));
  });
});
