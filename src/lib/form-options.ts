// Choices on the Start Project form for budget and expected timeline. Shared by the
// form (labels) and the server (the allowed values). No Zod here, so importing it
// into the browser costs only these strings.
//
// What is stored is `value`, a short English label that stays readable in the
// database and in exports even if the list changes later.
//
// PROVISIONAL: no pricing decision exists in either Mintapp repository. These
// budget bands are a placeholder for Omar to confirm or replace before release.
// Changing them needs no migration: older stored values stay readable as text.

export interface FormOption {
  value: string;
  en: string;
  ar: string;
}

export const NOT_SURE = "Not sure yet";

export const BUDGET_OPTIONS_PROVISIONAL = true;

export const BUDGET_OPTIONS: readonly FormOption[] = [
  { value: "Under USD 5,000", en: "Under USD 5,000", ar: "أقل من 5,000 دولار" },
  { value: "USD 5,000 - 15,000", en: "USD 5,000 – 15,000", ar: "من 5,000 إلى 15,000 دولار" },
  { value: "USD 15,000 - 40,000", en: "USD 15,000 – 40,000", ar: "من 15,000 إلى 40,000 دولار" },
  { value: "Over USD 40,000", en: "Over USD 40,000", ar: "أكثر من 40,000 دولار" },
  { value: NOT_SURE, en: "Not sure yet", ar: "لست متأكدًا بعد" },
];

export const TIMELINE_OPTIONS: readonly FormOption[] = [
  { value: "As soon as possible", en: "As soon as possible", ar: "في أقرب وقت ممكن" },
  { value: "Within 3 months", en: "Within 3 months", ar: "خلال 3 أشهر" },
  { value: "In 3 to 6 months", en: "In 3 to 6 months", ar: "خلال 3 إلى 6 أشهر" },
  { value: "Later than 6 months", en: "Later than 6 months", ar: "بعد أكثر من 6 أشهر" },
  { value: NOT_SURE, en: "Not sure yet", ar: "لست متأكدًا بعد" },
];

export const BUDGET_VALUES = BUDGET_OPTIONS.map((o) => o.value) as [string, ...string[]];
export const TIMELINE_VALUES = TIMELINE_OPTIONS.map((o) => o.value) as [string, ...string[]];

// The label for a stored value in the interface language; an older or unknown
// stored value is shown as it was stored.
export const optionLabel = (options: readonly FormOption[], value: string | null | undefined, lang: "en" | "ar"): string | null =>
  value ? (options.find((o) => o.value === value)?.[lang] ?? value) : null;
