import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { totp } from "../admin/totp.mjs";

// Sign-in as the deployed application does it: password, then an
// authenticator-app code (the first time, enrolling the authenticator). The
// auth service is the local test stand-in (scripts/admin-local.mjs).

const secrets = new Map<string, string>();
// Live runs (REAL Supabase Auth in the synthetic review project) get a random password per run.
export const PASSWORD = process.env.ADMIN_AUTH_LIVE === "1" ? (process.env.DASHBOARD_DEMO_PASSWORD ?? "") : "local-demo-password-for-tests-only";

export async function signInAs(browser: Browser, email: string, origin: string): Promise<Page> {
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/login/mfa");
  if (!secrets.has(email)) {
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    secrets.set(email, (await page.locator("code").textContent())!.trim());
  }
  await page.getByLabel("6-digit code").fill(totp(secrets.get(email)!));
  await page.getByRole("button", { name: "Verify" }).click();
  // Signing in lands on the dashboard; most flows start from Leads & Clients.
  await page.waitForURL("**/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/leads");
  return page;
}

// The Pack tab's structured editor: opens a part's editor and its sections.
export async function openEditor(page: Page, part: "design" | "proposal" | "discovery", sections: string[]) {
  const area = page.locator(`[data-artifact="${part}"]`);
  await area.locator("[data-edit] > summary").click();
  const editor = area.locator(`[data-artifact-editor="${part}"]`);
  for (const title of sections) await editor.locator("details > summary", { hasText: title }).click();
  return editor;
}

// A minimal, valid "Discovery and meeting plan" written by hand in English
// (no figure, no promise): three questions on three topics, an agenda of two, one next step.
export async function writeMeetingPlan(page: Page) {
  const editor = await openEditor(page, "discovery", ["Questions for the meeting", "Meeting agenda", "Next steps"]);
  const questions: [string, string, string][] = [
    ["Who books today, and how?", "Understand the current way of booking.", "operations"],
    ["What happens when a patient cancels?", "Design the cancellation flow.", "operations"],
    ["Who may change the schedule?", "Agree the roles.", "roles_permissions"],
  ];
  for (const [i, [q, p, bank]] of questions.entries()) {
    await editor.locator(`[name="discovery_questions.${i}.question"]`).fill(q);
    await editor.locator(`[name="discovery_questions.${i}.purpose"]`).fill(p);
    await editor.locator(`[name="discovery_questions.${i}.bank"]`).selectOption(bank);
  }
  for (const [i, [item, purpose]] of [["How booking works today", "Confirm the problem."], ["The first release", "Agree the next step."]].entries()) {
    await editor.locator(`[name="meeting_agenda.${i}.item"]`).fill(item);
    await editor.locator(`[name="meeting_agenda.${i}.purpose"]`).fill(purpose);
  }
  await editor.locator('[name="next_steps.0"]').fill("Confirm the booking rules after the meeting.");
  await editor.getByRole("button", { name: "Check and save as a new version" }).click();
}

// Approving a part: the other founder confirms the approval checklist first.
export async function approvePart(area: Locator) {
  const form = area.locator("[data-approve-form]");
  await form.locator('input[name="checked"]').check();
  await form.getByRole("button", { name: "Approve for the meeting" }).click();
}
