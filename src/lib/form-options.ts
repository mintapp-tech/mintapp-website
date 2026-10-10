// Choices on the Start Project form for budget and expected timeline. Shared by the
// form (labels), the server (accepted values, what is stored) and every place that
// shows them (CRM, team email, CSV export, the preparation brief). No Zod here, so
// importing it into the browser costs only these strings.
//
// The budget has two scales, US dollars and Egyptian pounds (budget-currency.ts
// chooses which one a visitor starts with). They are separate ranges, never a
// conversion of one another. New submissions store the currency and a stable range
// code valid for it; the codes of the two scales never overlap except `not_sure`.
// People only ever see labels.
//
// Older cached forms sent no currency: their values are US dollars. They sent
// either today's USD codes or, earlier, English labels: a label with an exact
// counterpart is stored as that code; the earlier placeholder budget bands, which
// straddle today's bands, are stored as sent rather than guessed into another band.
// Existing database rows are never rewritten; every stored form is shown with a
// label, and anything unknown is shown as stored.

import type { BudgetCurrency } from "./budget-currency";

export interface FormOption {
  value: string;
  en: string;
  ar: string;
}
type Lang = "en" | "ar";

export const NOT_SURE = "not_sure";

export const BUDGET_SCALES: Record<BudgetCurrency, readonly FormOption[]> = {
  USD: [
    { value: "under_2500", en: "Under USD 2,500", ar: "أقل من 2,500 دولار أمريكي" },
    { value: "2500_5000", en: "USD 2,500–5,000", ar: "من 2,500 إلى 5,000 دولار أمريكي" },
    { value: "5000_10000", en: "USD 5,000–10,000", ar: "من 5,000 إلى 10,000 دولار أمريكي" },
    { value: "10000_20000", en: "USD 10,000–20,000", ar: "من 10,000 إلى 20,000 دولار أمريكي" },
    { value: "over_20000", en: "Over USD 20,000", ar: "أكثر من 20,000 دولار أمريكي" },
    { value: NOT_SURE, en: "Not sure yet", ar: "لست متأكدًا بعد" },
  ],
  EGP: [
    { value: "under_50000", en: "Under EGP 50,000", ar: "أقل من 50,000 جنيه مصري" },
    { value: "50000_100000", en: "EGP 50,000–100,000", ar: "من 50,000 إلى 100,000 جنيه مصري" },
    { value: "100000_250000", en: "EGP 100,000–250,000", ar: "من 100,000 إلى 250,000 جنيه مصري" },
    { value: "250000_500000", en: "EGP 250,000–500,000", ar: "من 250,000 إلى 500,000 جنيه مصري" },
    { value: "over_500000", en: "Over EGP 500,000", ar: "أكثر من 500,000 جنيه مصري" },
    { value: NOT_SURE, en: "Not sure yet", ar: "لست متأكدًا بعد" },
  ],
};
// The US-dollar scale (the only one before currencies were added).
export const BUDGET_OPTIONS = BUDGET_SCALES.USD;

// How a currency is named next to "Not sure yet", where the range itself does not say it.
export const CURRENCY_NAMES: Record<BudgetCurrency, Record<Lang, string>> = {
  USD: { en: "US dollars", ar: "بالدولار الأمريكي" },
  EGP: { en: "Egyptian pounds", ar: "بالجنيه المصري" },
};

export const TIMELINE_OPTIONS: readonly FormOption[] = [
  { value: "asap", en: "As soon as possible", ar: "في أقرب وقت ممكن" },
  { value: "within_3_months", en: "Within 3 months", ar: "خلال 3 أشهر" },
  { value: "3_to_6_months", en: "In 3 to 6 months", ar: "خلال 3 إلى 6 أشهر" },
  { value: "over_6_months", en: "Later than 6 months", ar: "بعد أكثر من 6 أشهر" },
  { value: NOT_SURE, en: "Not sure yet", ar: "لست متأكدًا بعد" },
];

// What older cached forms sent. `code` when the meaning is exactly a current option.
interface Legacy {
  code?: string;
  en: string;
  ar: string;
}
const LEGACY_BUDGET: Record<string, Legacy> = {
  "Under USD 5,000": { en: "Under USD 5,000", ar: "أقل من 5,000 دولار أمريكي" },
  "USD 5,000 - 15,000": { en: "USD 5,000–15,000", ar: "من 5,000 إلى 15,000 دولار أمريكي" },
  "USD 15,000 - 40,000": { en: "USD 15,000–40,000", ar: "من 15,000 إلى 40,000 دولار أمريكي" },
  "Over USD 40,000": { en: "Over USD 40,000", ar: "أكثر من 40,000 دولار أمريكي" },
  "Not sure yet": { code: NOT_SURE, en: "Not sure yet", ar: "لست متأكدًا بعد" },
};
const LEGACY_TIMELINE: Record<string, Legacy> = Object.fromEntries(
  [
    ["As soon as possible", "asap"],
    ["Within 3 months", "within_3_months"],
    ["In 3 to 6 months", "3_to_6_months"],
    ["Later than 6 months", "over_6_months"],
    ["Not sure yet", NOT_SURE],
  ].map(([value, code]) => {
    const o = TIMELINE_OPTIONS.find((x) => x.value === code)!;
    return [value, { code, en: o.en, ar: o.ar }];
  }),
);

const own = <T,>(map: Record<string, T>, key: string) => (Object.hasOwn(map, key) ? map[key] : undefined);
const codes = (options: readonly FormOption[]) => new Map(options.map((o) => [o.value, o]));
const USD_CODES = codes(BUDGET_SCALES.USD);
const EGP_CODES = codes(BUDGET_SCALES.EGP);

// ----- Budget

// Every value a submission may carry for the budget: either scale's codes and
// older cached forms' labels. Which ones are valid depends on the currency.
export const BUDGET_ACCEPTED = [...new Set([...USD_CODES.keys(), ...EGP_CODES.keys(), ...Object.keys(LEGACY_BUDGET)])] as [string, ...string[]];

// What to store for a submitted budget, or null when the combination is not valid.
// A currency must come with a range from its own scale; no currency means an
// older cached form, whose values are US dollars.
export function storedBudget(range: string, currency: string | undefined): { range: string; currency: BudgetCurrency } | null {
  if (currency === undefined) {
    if (USD_CODES.has(range)) return { range, currency: "USD" };
    const old = own(LEGACY_BUDGET, range);
    return old ? { range: old.code ?? range, currency: "USD" } : null;
  }
  if (currency === "USD") return USD_CODES.has(range) ? { range, currency } : null;
  if (currency === "EGP") return EGP_CODES.has(range) ? { range, currency } : null;
  return null;
}

// The label for a stored budget, in a language. The stored currency picks the
// scale; a row without one (older rows) is read by its code, whose scale is
// unambiguous, or as an older US-dollar label. "Not sure yet" names the currency
// when it is known. Anything unknown is shown as stored; nothing stored, nothing shown.
export function budgetLabel(range: string | null | undefined, currency: string | null | undefined, lang: Lang): string | null {
  if (!range) return null;
  const known = currency === "USD" || currency === "EGP" ? (currency as BudgetCurrency) : null;
  if (range === NOT_SURE) return known ? `${BUDGET_SCALES.USD[5][lang]} (${CURRENCY_NAMES[known][lang]})` : BUDGET_SCALES.USD[5][lang];
  const option = (known === "EGP" ? EGP_CODES.get(range) : known === "USD" ? USD_CODES.get(range) : undefined) ?? USD_CODES.get(range) ?? EGP_CODES.get(range) ?? own(LEGACY_BUDGET, range);
  return option ? option[lang] : range;
}

// ----- Timeline

export const TIMELINE_ACCEPTED = [...TIMELINE_OPTIONS.map((o) => o.value), ...Object.keys(LEGACY_TIMELINE)] as [string, ...string[]];

export function storedTimeline(value: string): string | null {
  if (TIMELINE_OPTIONS.some((o) => o.value === value)) return value;
  const old = own(LEGACY_TIMELINE, value);
  return old?.code ?? null;
}

export function timelineLabel(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null;
  const option = TIMELINE_OPTIONS.find((o) => o.value === value) ?? own(LEGACY_TIMELINE, value);
  return option ? option[lang] : value;
}
