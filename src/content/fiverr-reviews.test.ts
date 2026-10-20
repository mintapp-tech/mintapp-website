import { describe, expect, test } from "vitest";
import { COUNTRY_NAMES, FIVERR_PROFILE_URL, FIVERR_REVIEWS, FIVERR_SUMMARY } from "./fiverr-reviews";

describe("Fiverr reviews", () => {
  test("only reviews of 4 stars or more are shown, and never more than the profile has", () => {
    expect(FIVERR_REVIEWS).toHaveLength(19);
    expect(FIVERR_REVIEWS.every((r) => r.rating >= 4 && r.rating <= 5)).toBe(true);
    expect(FIVERR_REVIEWS.length).toBeLessThanOrEqual(FIVERR_SUMMARY.count);
  });

  test("quotes are whole, never Fiverr's truncated preview", () => {
    for (const r of FIVERR_REVIEWS) {
      expect(r.quote.trim(), r.user).not.toBe("");
      expect(r.quote, r.user).not.toMatch(/See (more|less)$/);
    }
  });

  test("every country code is a real region", () => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (const r of FIVERR_REVIEWS) expect(names.of(r.country), r.user).not.toBe(r.country);
  });

  test("Palestine is named Palestine", () => {
    expect(FIVERR_REVIEWS.find((r) => r.user === "yazenothman")?.country).toBe("PS");
    expect(COUNTRY_NAMES.PS).toEqual({ en: "Palestine", ar: "فلسطين" });
  });

  test("the section links to the public profile", () => {
    expect(FIVERR_PROFILE_URL).toBe("https://www.fiverr.com/abdelrahmanayme");
  });
});
