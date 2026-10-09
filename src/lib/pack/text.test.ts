import { describe, expect, test } from "vitest";
import { artifactLanguage, artifactSections, artifactText } from "./text";
import { splitPack } from "./schema";
import { clinicPack } from "./test-fixtures";

describe("an artifact as text", () => {
  const parts = splitPack(clinicPack());

  test("the proposal, the discovery pack and the design each read as plain text in their own language", () => {
    const proposal = artifactText(parts.proposal);
    expect(proposal).toContain(clinicPack().proposal.understanding);
    expect(proposal).toContain("First release scope");
    const discovery = artifactText(parts.discovery);
    for (const q of clinicPack().discovery_questions) expect(discovery).toContain(q.question);
    expect(discovery).toContain("Confirm before pricing");
    const design = artifactText(parts.design);
    expect(design).toContain("User flow");
    expect(design).toContain(clinicPack().screens[0].title);
    const ar = artifactText({ ...parts.proposal, language: "ar" });
    expect(ar).toContain("نطاق الإصدار الأول");
  });

  test("the sections are the same content as the text, headed", () => {
    const sections = artifactSections(parts.discovery)!;
    expect(sections.map((x) => x.title)).toContain("Questions to ask");
    expect(artifactText(parts.discovery)).toContain(sections[0].lines[0]);
    expect(artifactSections({ format: "text", body: "x" })).toBeNull();
  });

  test("a text version is its body; anything unknown is empty", () => {
    expect(artifactText({ format: "text", body: "Hand-written notes" })).toBe("Hand-written notes");
    expect(artifactText({ format: "text", body: 3 })).toBe("");
    expect(artifactText(null)).toBe("");
    expect(artifactText({ format: "something" })).toBe("");
  });

  test("the language of a version is read from it, and is unknown for text", () => {
    expect(artifactLanguage(parts.design)).toBe("en");
    expect(artifactLanguage({ format: "text", body: "x" })).toBeNull();
  });
});
