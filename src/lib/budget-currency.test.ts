import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COUNTRY_HEADER, RETIRED_CURRENCY_COOKIE, budgetCurrencyFor, currencyForCountry, normalizeCountry } from "./budget-currency";

describe("which budget scale a request gets (the server's decision)", () => {
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

  test("from request headers: only the country header counts, and nothing else can choose", () => {
    const h = (entries: Record<string, string>) => new Headers(entries);
    expect(budgetCurrencyFor(h({ [COUNTRY_HEADER]: "EG" }))).toBe("EGP");
    expect(budgetCurrencyFor(h({ [COUNTRY_HEADER]: "AE" }))).toBe("USD");
    expect(budgetCurrencyFor(h({}))).toBe("USD");
    // A cookie or any other header naming a currency is not read.
    expect(budgetCurrencyFor(h({ cookie: `${RETIRED_CURRENCY_COOKIE}=EGP`, "x-budget-currency": "EGP" }))).toBe("USD");
    expect(budgetCurrencyFor(h({ [COUNTRY_HEADER]: "EG", cookie: `${RETIRED_CURRENCY_COOKIE}=USD` }))).toBe("EGP");
  });

  test("no visitor preference exists any more: nothing reads or writes the retired cookie except the proxy that expires it", () => {
    const root = process.cwd();
    for (const file of ["src/app/[locale]/start/page.tsx", "src/components/start/StartExperience.tsx", "src/app/api/inquiries/route.ts", "src/lib/inquiry-schema.ts"]) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toMatch(/RETIRED_CURRENCY_COOKIE|mintapp_budget_currency|document\.cookie|cookies\(\)/);
    }
    expect(readFileSync(join(root, "src/proxy.ts"), "utf8")).toMatch(/RETIRED_CURRENCY_COOKIE, "", \{ path: "\/", maxAge: 0/);
  });

  test("only the host's country header is read for this; never an IP address, and the country is never logged", () => {
    expect(COUNTRY_HEADER).toBe("x-vercel-ip-country");
    const root = process.cwd();
    for (const file of ["src/lib/budget-currency.ts", "src/app/[locale]/start/page.tsx", "src/components/start/StartExperience.tsx"]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toMatch(/x-forwarded-for|x-real-ip|cf-connecting-ip|remoteip|request\.ip|console\.(log|info|warn|error)/i);
    }
    // The route reads the country only through budgetCurrencyFor, and never logs it.
    const route = readFileSync(join(root, "src/app/api/inquiries/route.ts"), "utf8");
    expect(route).not.toMatch(/x-vercel-ip-country|COUNTRY_HEADER/);
    expect(route).not.toMatch(/console\.\w+\([^)]*(country|budgetCurrencyFor)/i);
  });
});
