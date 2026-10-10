// Which currency the budget question starts in. Pure and browser-safe.
//
// Egypt is the only special case: a visitor whose request comes from Egypt starts
// in Egyptian pounds; everyone else, and anyone whose country is unknown, starts
// in US dollars. The visitor can always switch, and a currency they chose
// themselves (remembered in a first-party cookie) wins over the country. The
// country is only ever the two-letter code a host adds to the request
// (x-vercel-ip-country); no IP address is read, stored or logged.

export const BUDGET_CURRENCIES = ["USD", "EGP"] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

export const BUDGET_CURRENCY_COOKIE = "mintapp_budget_currency";
// The header Vercel adds with the visitor's country (ISO 3166-1 alpha-2).
export const COUNTRY_HEADER = "x-vercel-ip-country";

export const isBudgetCurrency = (value: unknown): value is BudgetCurrency => value === "USD" || value === "EGP";

// Only a well-formed two-letter code counts; anything else is "unknown".
export const normalizeCountry = (value: string | null | undefined): string | null => {
  const v = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(v) ? v : null;
};

export const currencyForCountry = (country: string | null | undefined): BudgetCurrency => (normalizeCountry(country) === "EG" ? "EGP" : "USD");

// A saved choice wins; otherwise the country decides; otherwise USD.
export function initialBudgetCurrency({ preference, country }: { preference?: string | null; country?: string | null }): BudgetCurrency {
  return isBudgetCurrency(preference) ? preference : currencyForCountry(country);
}

// Remembers the visitor's own choice for later visits (first-party, one year).
export function rememberBudgetCurrency(currency: BudgetCurrency) {
  try {
    document.cookie = `${BUDGET_CURRENCY_COOKIE}=${currency}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // cookies unavailable: the choice still applies to this visit
  }
}
