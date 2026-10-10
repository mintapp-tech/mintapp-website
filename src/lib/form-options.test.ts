import { describe, expect, test } from "vitest";
import { BUDGET, BUDGET_OPTIONS, NOT_SURE, TIMELINE, TIMELINE_OPTIONS, budgetLabel, timelineLabel } from "./form-options";

describe("budget and timeline choices", () => {
  test("stable codes, in order, each with an English and an Arabic label, and Not sure yet in both lists", () => {
    expect(BUDGET_OPTIONS.map((o) => o.value)).toEqual(["under_2500", "2500_5000", "5000_10000", "10000_20000", "over_20000", "not_sure"]);
    expect(BUDGET_OPTIONS.map((o) => o.en)).toEqual(["Under USD 2,500", "USD 2,500–5,000", "USD 5,000–10,000", "USD 10,000–20,000", "Over USD 20,000", "Not sure yet"]);
    expect(TIMELINE_OPTIONS.map((o) => o.value)).toEqual(["asap", "within_3_months", "3_to_6_months", "over_6_months", "not_sure"]);
    for (const o of [...BUDGET_OPTIONS, ...TIMELINE_OPTIONS]) {
      expect(o.en.trim()).not.toBe("");
      expect(o.ar).toMatch(/[؀-ۿ]/);
      // A label never shows a code.
      expect(o.en).not.toBe(o.value);
      expect(`${o.en} ${o.ar}`).not.toMatch(/_|\b(asap|not_sure)\b/);
    }
    expect(BUDGET_OPTIONS.at(-1)?.value).toBe(NOT_SURE);
    expect(TIMELINE_OPTIONS.at(-1)?.value).toBe(NOT_SURE);
  });

  test("new submissions store the code", () => {
    for (const o of BUDGET_OPTIONS) expect(BUDGET.stored(o.value)).toBe(o.value);
    for (const o of TIMELINE_OPTIONS) expect(TIMELINE.stored(o.value)).toBe(o.value);
  });

  test("older cached forms are still accepted: exact meanings become codes, the old budget bands are kept as sent", () => {
    expect(TIMELINE.stored("As soon as possible")).toBe("asap");
    expect(TIMELINE.stored("Within 3 months")).toBe("within_3_months");
    expect(TIMELINE.stored("In 3 to 6 months")).toBe("3_to_6_months");
    expect(TIMELINE.stored("Later than 6 months")).toBe("over_6_months");
    expect(TIMELINE.stored("Not sure yet")).toBe("not_sure");
    expect(BUDGET.stored("Not sure yet")).toBe("not_sure");
    // These bands have no exact counterpart: stored as sent, never moved into another band.
    for (const old of ["Under USD 5,000", "USD 5,000 - 15,000", "USD 15,000 - 40,000", "Over USD 40,000"]) expect(BUDGET.stored(old)).toBe(old);
    expect(BUDGET.accepted).toContain("USD 5,000 - 15,000");
    expect(BUDGET.stored("a million")).toBeNull();
    expect(TIMELINE.stored("yesterday")).toBeNull();
    expect(BUDGET.stored("constructor")).toBeNull();
  });

  test("every stored form is shown with a label in the reader's language", () => {
    expect(budgetLabel("5000_10000", "en")).toBe("USD 5,000–10,000");
    expect(budgetLabel("5000_10000", "ar")).toBe("من 5,000 إلى 10,000 دولار أمريكي");
    expect(budgetLabel("not_sure", "ar")).toBe("لست متأكدًا بعد");
    expect(timelineLabel("over_6_months", "en")).toBe("Later than 6 months");
    expect(timelineLabel("asap", "ar")).toBe("في أقرب وقت ممكن");
    // Rows written before codes: shown with their label, in either language.
    expect(budgetLabel("USD 5,000 - 15,000", "en")).toBe("USD 5,000–15,000");
    expect(budgetLabel("USD 5,000 - 15,000", "ar")).toBe("من 5,000 إلى 15,000 دولار أمريكي");
    expect(timelineLabel("Within 3 months", "ar")).toBe("خلال 3 أشهر");
    // Anything else is shown as stored; nothing stored, nothing shown.
    expect(budgetLabel("غير محدد", "en")).toBe("غير محدد");
    expect(budgetLabel(null, "en")).toBeNull();
    expect(timelineLabel("", "ar")).toBeNull();
  });
});
