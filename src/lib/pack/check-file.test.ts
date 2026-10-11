import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { PROJECT_TYPE_WORDS } from "@/lib/dashboard/project-type";
import { PACK_MESSAGES } from "@/lib/admin/pack-messages";
import { validatePack } from "./schema";

// The application's own validator on a Pack file from a private client workspace,
// before it is imported (npm run pack:check -- <workspace>). Runs only when the
// script sets PACK_FILE and PACK_BRIEF; otherwise it is skipped. Prints only problem
// kinds, never the Pack's content.

const file = process.env.PACK_FILE;
const briefFile = process.env.PACK_BRIEF;

// source/brief.md holds exactly the "Client brief" text of the copied prompt; comments are ignored.
export function briefFrom(markdown: string) {
  const brief = markdown.replace(/<!--[\s\S]*?-->/g, "").trim();
  const language: "en" | "ar" = /^وصف المشروع:/m.test(brief) ? "ar" : "en";
  const typed = brief.match(/^(?:Project type|نوع المشروع): (.+)$/m)?.[1]?.trim();
  const words = PROJECT_TYPE_WORDS[language] as Record<string, string>;
  const projectType = Object.keys(words).find((k) => words[k] === typed) ?? null;
  return { brief, language, projectType };
}

describe.runIf(!!file && !!briefFile)("a Pack file from a client workspace", () => {
  test("passes the application validator", () => {
    const ctx = briefFrom(readFileSync(briefFile!, "utf8"));
    expect(ctx.brief.length, "source/brief.md is empty: paste the client brief from the copied prompt").toBeGreaterThan(20);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file!, "utf8"));
    } catch {
      throw new Error("The Pack file is not valid JSON.");
    }
    const result = validatePack(json, ctx);
    const problems = result.ok ? [] : result.problems.map((p) => `${p.kind}${"section" in p ? ` (${p.section})` : "path" in p ? ` (${p.path})` : ""}: ${PACK_MESSAGES.en.problems[p.kind]}`);
    expect(problems, "Fix these before importing the Pack").toEqual([]);
  });
});

describe("reading a workspace brief", () => {
  test("takes the brief's language and the client's project type from the brief itself", () => {
    expect(briefFrom("<!-- paste below -->\nProject type: Web application\nProject description:\nA booking system.")).toMatchObject({ language: "en", projectType: "web_app" });
    expect(briefFrom("وصف المشروع:\nموقع لمدرسة.")).toMatchObject({ language: "ar", projectType: null });
  });
});
