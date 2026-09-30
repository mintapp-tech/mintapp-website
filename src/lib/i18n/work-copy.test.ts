import { describe, expect, test } from "vitest";
import { ar } from "./ar";
import { en } from "./en";

// All seven projects are real, completed and approved for public presentation, so no
// public copy may classify them as samples, concepts or demos.
const EN_SAMPLE_WORDING = /\b(sample|samples|concept|demo|mock-?up|hypothetical)\b/i;
const AR_SAMPLE_WORDING = /(تعريفية|تجريبي|افتراضي|نموذج تخيلي)/;

const CASE_STUDY_KEYS = ["csArrentio", "csJameel", "csNazarih", "csTaskaty", "csTangleVibe", "csRentop", "csKwayes"] as const;

describe("completed projects are presented as selected work, never as samples", () => {
  test("the Work section copy has no sample/concept classification", () => {
    expect(JSON.stringify(en.work)).not.toMatch(EN_SAMPLE_WORDING);
    expect(JSON.stringify(ar.work)).not.toMatch(AR_SAMPLE_WORDING);
  });

  test("no case study classifies its project as a sample or concept", () => {
    for (const key of CASE_STUDY_KEYS) {
      expect(JSON.stringify(en[key]), key).not.toMatch(EN_SAMPLE_WORDING);
      expect(JSON.stringify(ar[key]), key).not.toMatch(AR_SAMPLE_WORDING);
    }
  });
});
