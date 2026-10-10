import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COUNTRY_HEADER, currencyForCountry, initialBudgetCurrency, normalizeCountry } from "./budget-currency";

describe("which currency the budget question starts in", () => {
  test("Egypt starts in Egyptian pounds", () => {
    expect(currencyForCountry("EG")).toBe("EGP");
    expect(currencyForCountry(" eg ")).toBe("EGP");
  });

  test.each(["SA", "AE", "KW", "QA", "BH", "OM"])("the Gulf (%s) starts in US dollars", (country) => {
    expect(currencyForCountry(country)).toBe("USD");
  });

  test.each(["JO", "MA", "LB", "US", "GB", "DE", "IN"])("everywhere else (%s) starts in US dollars", (country) => {
    expect(currencyForCountry(country)).toBe("USD");
  });

  test.each([null, undefined, "", "  ", "XX1", "EGY", "E", "e-g", "1A"])("an unknown or malformed country (%j) starts in US dollars", (country) => {
    expect(currencyForCountry(country)).toBe("USD");
  });

  test("only a two-letter code is taken as a country", () => {
    expect(normalizeCountry("eg")).toBe("EG");
    expect(normalizeCountry("EGY")).toBeNull();
    expect(normalizeCountry("203.0.113.7")).toBeNull();
  });

  test("a currency the visitor chose wins over the country, both ways; anything else in the cookie is ignored", () => {
    expect(initialBudgetCurrency({ preference: "USD", country: "EG" })).toBe("USD");
    expect(initialBudgetCurrency({ preference: "EGP", country: "SA" })).toBe("EGP");
    expect(initialBudgetCurrency({ preference: "EGP", country: null })).toBe("EGP");
    expect(initialBudgetCurrency({ preference: "eur", country: "EG" })).toBe("EGP");
    expect(initialBudgetCurrency({ preference: undefined, country: "AE" })).toBe("USD");
    expect(initialBudgetCurrency({})).toBe("USD");
  });

  test("only the host's country header is read for this; never an IP address", () => {
    expect(COUNTRY_HEADER).toBe("x-vercel-ip-country");
    const root = process.cwd();
    for (const file of ["src/lib/budget-currency.ts", "src/app/[locale]/start/page.tsx", "src/components/start/StartExperience.tsx"]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toMatch(/x-forwarded-for|x-real-ip|cf-connecting-ip|remoteip|request\.ip|console\.(log|info|warn|error)/i);
    }
  });
});
