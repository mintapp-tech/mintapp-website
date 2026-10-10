// Which budget scale a visitor is shown. Pure and browser-safe.
//
// The Egyptian-pound ranges are bands for the Egyptian market, not a conversion of
// the US-dollar ones, so the scale is not the visitor's choice: a request from
// Egypt gets the Egyptian-pound scale; every other country, and any request whose
// country is missing or malformed, gets the US-dollar scale. The server decides
// this for every request, for the page and again when the form is submitted, and
// stores only the currency that results. The country is only ever the two-letter
// code the host adds to the request (x-vercel-ip-country); no IP address is read,
// stored or logged, and the country itself is neither stored nor logged.

export const BUDGET_CURRENCIES = ["USD", "EGP"] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

// The header Vercel adds with the visitor's country (ISO 3166-1 alpha-2).
export const COUNTRY_HEADER = "x-vercel-ip-country";

// An earlier review build let visitors pick a currency and remembered it in this
// cookie. Nothing reads it any more; the public proxy expires it when it is seen.
export const RETIRED_CURRENCY_COOKIE = "mintapp_budget_currency";

export const isBudgetCurrency = (value: unknown): value is BudgetCurrency => value === "USD" || value === "EGP";

// Only a well-formed two-letter code counts; anything else is "unknown".
export const normalizeCountry = (value: string | null | undefined): string | null => {
  const v = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(v) ? v : null;
};

export const currencyForCountry = (country: string | null | undefined): BudgetCurrency => (normalizeCountry(country) === "EG" ? "EGP" : "USD");

// The scale for one request, from its headers only.
export const budgetCurrencyFor = (headers: { get(name: string): string | null }): BudgetCurrency => currencyForCountry(headers.get(COUNTRY_HEADER));
