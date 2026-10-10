import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installTurnstileMock, mockInquiriesRoute } from "./turnstile-mock";

// The Start Project form's project-type question, in English and Arabic.
// Nothing here reaches a real backend: Turnstile is mocked and /api/inquiries
// is intercepted.

const COPY = {
  en: { label: "Project type", options: ["Website", "Web application", "Mobile application", "Not sure yet"] },
  ar: { label: "نوع المشروع", options: ["موقع إلكتروني", "تطبيق ويب", "تطبيق جوّال", "لست متأكدًا بعد"] },
} as const;
const VALUES = ["website", "web_app", "mobile_app", "not_sure"];

async function fillEverythingExceptProjectType(page: Page) {
  const textInputs = page.locator('form input:not([type="checkbox"]):not([type="radio"]):not([tabindex="-1"])');
  await textInputs.nth(0).fill("Test User");
  await textInputs.nth(2).fill("test@example.com");
  await page.locator('select[name="budget"]').selectOption("not_sure");
  await page.locator('select[name="timeline"]').selectOption("not_sure");
  await page.locator("form textarea").first().fill("A".repeat(40));
  await page.locator('input[type="checkbox"]').check();
}

for (const locale of ["en", "ar"] as const) {
  test.describe(`${locale}: project type question`, () => {
    test("is a labelled group of four options in order, none chosen", async ({ page }) => {
      await installTurnstileMock(page);
      await page.goto(`/${locale}/start`);
      const group = page.getByRole("radiogroup", { name: COPY[locale].label });
      await expect(group).toBeVisible();
      const radios = group.getByRole("radio");
      await expect(radios).toHaveCount(4);
      for (const [i, text] of COPY[locale].options.entries()) {
        await expect(radios.nth(i)).toHaveAccessibleName(text);
        await expect(radios.nth(i)).toHaveAttribute("value", VALUES[i]);
        await expect(radios.nth(i)).not.toBeChecked();
      }
      // "Not sure yet" is a real answer: it is offered alongside the others, not hidden.
      await expect(group.getByText(COPY[locale].options[3])).toBeVisible();
    });

    test("is required: everything else filled, sending stays disabled until a type is chosen", async ({ page }) => {
      await installTurnstileMock(page);
      await page.goto(`/${locale}/start`);
      await fillEverythingExceptProjectType(page);
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await page.locator('label:has(input[value="mobile_app"])').click();
      await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
    });

    test("sends exactly the stored value, never the visible words", async ({ page }) => {
      await installTurnstileMock(page);
      const requests = await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));
      await page.goto(`/${locale}/start`);
      await fillEverythingExceptProjectType(page);
      await page.locator('label:has(input[value="not_sure"])').click();
      await page.locator('button[type="submit"]').click();
      await expect.poll(() => requests.length).toBe(1);
      const body = JSON.parse(requests[0]);
      expect(body.projectType).toBe("not_sure");
      expect(body.lang).toBe(locale);
    });

    test("keyboard: one tab stop, arrows choose, the choice is visible without colour", async ({ page }) => {
      await installTurnstileMock(page, { autoComplete: false });
      await page.goto(`/${locale}/start`);
      await page.locator('input[name="projectType"]').first().focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      const third = page.locator('input[value="mobile_app"]');
      await expect(third).toBeChecked();
      await expect(third).toBeFocused();
      // A focus ring on the chosen option, and a filled indicator that does not depend on its colour alone.
      const chosen = page.locator('label:has(input[value="mobile_app"])');
      await expect(chosen).toHaveCSS("outline-style", "solid");
      expect(await chosen.locator("span[aria-hidden] span").evaluate((el) => getComputedStyle(el).scale)).not.toBe("0");
      // Only the chosen option has a visible dot.
      const other = page.locator('label:has(input[value="website"]) span[aria-hidden] span');
      expect(await other.evaluate((el) => getComputedStyle(el).scale)).toBe("0");
    });

    test("a server rejection of the field is shown on it and focus moves to it", async ({ page }) => {
      await installTurnstileMock(page);
      await mockInquiriesRoute(page, () => ({ status: 400, body: { error: "Invalid submission.", fields: { projectType: "invalid_value" } } }));
      await page.goto(`/${locale}/start`);
      await fillEverythingExceptProjectType(page);
      await page.locator('label:has(input[value="website"])').click();
      await page.locator('button[type="submit"]').click();
      const group = page.getByRole("radiogroup", { name: COPY[locale].label });
      await expect(group).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#project-type-error")).toBeVisible();
      await expect(page.locator('input[name="projectType"]').first()).toBeFocused();
      // Choosing again clears the message.
      await page.locator('label:has(input[value="web_app"])').click();
      await expect(page.locator("#project-type-error")).toHaveCount(0);
    });

    test("fits every viewport: stacked on the smallest phones, two columns on phones, one row from tablet up, no overflow, no clipped text", async ({ page }) => {
      await installTurnstileMock(page);
      for (const [width, expectedRows] of [[320, 4], [360, 2], [390, 2], [768, 1], [1280, 1]] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/start`);
        const labels = page.locator("fieldset label");
        const tops = await labels.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
        expect(new Set(tops).size, `${width}px rows`).toBe(expectedRows);
        const clipped = await labels.evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
        expect(clipped, `${width}px clipped`).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`).toBe(true);
        // Touch-friendly: every option is at least 44px tall.
        const heights = await labels.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
      }
    });

    test("the form region has no accessibility violations, empty and with an error", async ({ page }) => {
      await installTurnstileMock(page);
      await mockInquiriesRoute(page, () => ({ status: 400, body: { error: "Invalid submission.", fields: { projectType: "invalid_value" } } }));
      await page.goto(`/${locale}/start`);
      // Reports each offending node, not just the rule id, so a failure says what to fix.
      const scan = async () => {
        await page.waitForTimeout(1500); // let the reveal animations finish: axe would otherwise measure half-faded text
        return (await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => `${n.target.join(" ")} :: ${n.any.map((a) => a.message).join("; ")}`),
        }));
      };
      expect(await scan()).toEqual([]);
      await fillEverythingExceptProjectType(page);
      await page.locator('label:has(input[value="website"])').click();
      await page.locator('button[type="submit"]').click();
      await expect(page.locator("#project-type-error")).toBeVisible();
      expect(await scan()).toEqual([]);
    });
  });
}

test("Arabic: the group reads right to left, first option on the right", async ({ page }) => {
  await installTurnstileMock(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ar/start");
  const lefts = await page.locator("fieldset label").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  expect(lefts).toEqual([...lefts].sort((a, b) => b - a));
  await expect(page.locator("fieldset label").first()).toContainText("موقع إلكتروني");
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("choosing an option does not animate", async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto("/en/start");
    const label = page.locator('label:has(input[value="website"])');
    await label.click();
    const props = await label.evaluate((el) => [getComputedStyle(el).transitionProperty, getComputedStyle(el.querySelector("span[aria-hidden] span")!).transitionProperty]);
    expect(props).toEqual(["none", "none"]);
  });
});
