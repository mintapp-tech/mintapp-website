// Choices on the Start Project form for budget and expected timeline. Shared by the
// form (labels), the server (accepted values, what is stored) and every place that
// shows them (CRM, team email, the preparation brief). No Zod here, so importing
// it into the browser costs only these strings.
//
// New submissions store a stable code (`value`); people only ever see a label.
// Older cached forms sent English labels instead: those are still accepted. A
// legacy value with an exact counterpart is stored as that code; a legacy budget
// band with no exact counterpart (the earlier, unapproved placeholder bands) is
// stored as it was sent rather than guessed into a different band. Existing
// database rows are never rewritten; every stored form is shown with a label.

export interface FormOption {
  value: string;
  en: string;
  ar: string;
}
type Lang = "en" | "ar";

export const NOT_SURE = "not_sure";

// Estimated budget in US dollars, or the equivalent in the client's currency.
export const BUDGET_OPTIONS: readonly FormOption[] = [
  { value: "under_2500", en: "Under USD 2,500", ar: "أقل من 2,500 دولار أمريكي" },
  { value: "2500_5000", en: "USD 2,500–5,000", ar: "من 2,500 إلى 5,000 دولار أمريكي" },
  { value: "5000_10000", en: "USD 5,000–10,000", ar: "من 5,000 إلى 10,000 دولار أمريكي" },
  { value: "10000_20000", en: "USD 10,000–20,000", ar: "من 10,000 إلى 20,000 دولار أمريكي" },
  { value: "over_20000", en: "Over USD 20,000", ar: "أكثر من 20,000 دولار أمريكي" },
  { value: NOT_SURE, en: "Not sure yet", ar: "لست متأكدًا بعد" },
];

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

function field(options: readonly FormOption[], legacy: Record<string, Legacy>) {
  const byCode = new Map(options.map((o) => [o.value, o]));
  return {
    // Every value a submission may carry: today's codes and older cached forms' labels.
    accepted: [...options.map((o) => o.value), ...Object.keys(legacy)] as [string, ...string[]],
    // What to store for an accepted value (a code whenever the meaning is exact).
    stored(value: string): string | null {
      if (byCode.has(value)) return value;
      const old = own(legacy, value);
      return old ? (old.code ?? value) : null;
    },
    // The label for a stored value in a language; anything unknown is shown as stored.
    label(value: string | null | undefined, lang: Lang): string | null {
      if (!value) return null;
      const option = byCode.get(value) ?? own(legacy, value);
      return option ? option[lang] : value;
    },
  };
}

export const BUDGET = field(BUDGET_OPTIONS, LEGACY_BUDGET);
export const TIMELINE = field(TIMELINE_OPTIONS, LEGACY_TIMELINE);

export const budgetLabel = (value: string | null | undefined, lang: Lang) => BUDGET.label(value, lang);
export const timelineLabel = (value: string | null | undefined, lang: Lang) => TIMELINE.label(value, lang);
