import { describe, expect, test } from "vitest";
import { BUDGET_ACCEPTED, BUDGET_SCALES, NOT_SURE, TIMELINE_OPTIONS, budgetLabel, storedBudget, storedTimeline, timelineLabel } from "./form-options";

const USD_CODES = ["under_2500", "2500_5000", "5000_10000", "10000_20000", "over_20000", "not_sure"];
const EGP_CODES = ["under_50000", "50000_100000", "100000_250000", "250000_500000", "over_500000", "not_sure"];

describe("budget scales", () => {
  test("US dollars: the approved codes and labels, unchanged", () => {
    expect(BUDGET_SCALES.USD.map((o) => o.value)).toEqual(USD_CODES);
    expect(BUDGET_SCALES.USD.map((o) => o.en)).toEqual(["Under USD 2,500", "USD 2,500–5,000", "USD 5,000–10,000", "USD 10,000–20,000", "Over USD 20,000", "Not sure yet"]);
    expect(BUDGET_SCALES.USD.map((o) => o.ar)).toEqual(["أقل من 2,500 دولار أمريكي", "من 2,500 إلى 5,000 دولار أمريكي", "من 5,000 إلى 10,000 دولار أمريكي", "من 10,000 إلى 20,000 دولار أمريكي", "أكثر من 20,000 دولار أمريكي", "لست متأكدًا بعد"]);
  });

  test("Egyptian pounds: its own codes and labels", () => {
    expect(BUDGET_SCALES.EGP.map((o) => o.value)).toEqual(EGP_CODES);
    expect(BUDGET_SCALES.EGP.map((o) => o.en)).toEqual(["Under EGP 50,000", "EGP 50,000–100,000", "EGP 100,000–250,000", "EGP 250,000–500,000", "Over EGP 500,000", "Not sure yet"]);
    expect(BUDGET_SCALES.EGP.map((o) => o.ar)).toEqual(["أقل من 50,000 جنيه مصري", "من 50,000 إلى 100,000 جنيه مصري", "من 100,000 إلى 250,000 جنيه مصري", "من 250,000 إلى 500,000 جنيه مصري", "أكثر من 500,000 جنيه مصري", "لست متأكدًا بعد"]);
  });

  test("the two scales share only not_sure, so a stored code says which scale it is from", () => {
    expect(USD_CODES.filter((c) => EGP_CODES.includes(c))).toEqual([NOT_SURE]);
  });

  test("no label shows a code", () => {
    for (const o of [...BUDGET_SCALES.USD, ...BUDGET_SCALES.EGP, ...TIMELINE_OPTIONS]) {
      expect(`${o.en} ${o.ar}`).not.toMatch(/_|\b(asap|not_sure)\b/);
      expect(o.ar).toMatch(/[؀-ۿ]/);
    }
  });
});

describe("what is stored for a submitted budget", () => {
  test("a range from the chosen currency's scale is stored with that currency", () => {
    for (const range of USD_CODES) expect(storedBudget(range, "USD")).toEqual({ range, currency: "USD" });
    for (const range of EGP_CODES) expect(storedBudget(range, "EGP")).toEqual({ range, currency: "EGP" });
  });

  test("a range from the other scale, or an unknown currency, is refused", () => {
    expect(storedBudget("under_50000", "USD")).toBeNull();
    expect(storedBudget("5000_10000", "EGP")).toBeNull();
    expect(storedBudget("Under USD 5,000", "EGP")).toBeNull();
    expect(storedBudget("Under USD 5,000", "USD")).toBeNull(); // today's form never sends labels with a currency
    expect(storedBudget("not_sure", "EUR")).toBeNull();
    expect(storedBudget("not_sure", "usd")).toBeNull();
    expect(storedBudget("a million", "USD")).toBeNull();
  });

  test("an older cached form sends no currency: its values are US dollars", () => {
    expect(storedBudget("5000_10000", undefined)).toEqual({ range: "5000_10000", currency: "USD" });
    expect(storedBudget("Not sure yet", undefined)).toEqual({ range: "not_sure", currency: "USD" });
    // The earlier placeholder bands straddle today's: stored as sent, never moved into another band.
    expect(storedBudget("USD 5,000 - 15,000", undefined)).toEqual({ range: "USD 5,000 - 15,000", currency: "USD" });
    // An Egyptian range never arrived without a currency.
    expect(storedBudget("under_50000", undefined)).toBeNull();
    expect(storedBudget("constructor", undefined)).toBeNull();
    expect(BUDGET_ACCEPTED).toContain("Over USD 40,000");
  });
});

describe("how a stored budget is shown", () => {
  test("by its currency's label, in the reader's language", () => {
    expect(budgetLabel("100000_250000", "EGP", "en")).toBe("EGP 100,000–250,000");
    expect(budgetLabel("100000_250000", "EGP", "ar")).toBe("من 100,000 إلى 250,000 جنيه مصري");
    expect(budgetLabel("5000_10000", "USD", "en")).toBe("USD 5,000–10,000");
    expect(budgetLabel("over_20000", "USD", "ar")).toBe("أكثر من 20,000 دولار أمريكي");
  });

  test("Not sure yet names the currency when it is known", () => {
    expect(budgetLabel("not_sure", "EGP", "en")).toBe("Not sure yet (Egyptian pounds)");
    expect(budgetLabel("not_sure", "USD", "ar")).toBe("لست متأكدًا بعد (بالدولار الأمريكي)");
    expect(budgetLabel("not_sure", null, "en")).toBe("Not sure yet");
  });

  test("older rows without a currency stay readable and are never mislabelled", () => {
    expect(budgetLabel("Not sure yet", null, "ar")).toBe("لست متأكدًا بعد");
    expect(budgetLabel("USD 5,000 - 15,000", null, "en")).toBe("USD 5,000–15,000");
    expect(budgetLabel("5000_10000", null, "en")).toBe("USD 5,000–10,000");
    expect(budgetLabel("under_50000", null, "en")).toBe("Under EGP 50,000");
    expect(budgetLabel("غير محدد", null, "en")).toBe("غير محدد");
    expect(budgetLabel(null, "EGP", "en")).toBeNull();
    expect(budgetLabel("", null, "ar")).toBeNull();
  });
});

describe("timeline", () => {
  test("codes, older labels and display", () => {
    expect(TIMELINE_OPTIONS.map((o) => o.value)).toEqual(["asap", "within_3_months", "3_to_6_months", "over_6_months", "not_sure"]);
    expect(storedTimeline("within_3_months")).toBe("within_3_months");
    expect(storedTimeline("Later than 6 months")).toBe("over_6_months");
    expect(storedTimeline("Not sure yet")).toBe("not_sure");
    expect(storedTimeline("yesterday")).toBeNull();
    expect(timelineLabel("asap", "ar")).toBe("في أقرب وقت ممكن");
    expect(timelineLabel("Within 3 months", "ar")).toBe("خلال 3 أشهر");
    expect(timelineLabel("خلال شهرين", "en")).toBe("خلال شهرين");
  });
});
