import { describe, expect, test } from "vitest";
import { buildGenerationInput } from "@/lib/preparation/input";
import { SYNTHETIC_BRIEFS } from "@/lib/preparation/synthetic-briefs";
import { EDITOR, contentFrom, fieldsFrom, fieldsFromForm, optionValues } from "./editor";
import { SECTIONS, splitPack, validateArtifact } from "./schema";
import { clinicPack } from "./test-fixtures";

const input = buildGenerationInput(SYNTHETIC_BRIEFS[0].inquiry);
const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };
const parts = splitPack(clinicPack());

describe("the structured editor", () => {
  test("covers every section of every part, and nothing else", () => {
    for (const kind of ["design", "proposal", "discovery"] as const) expect(EDITOR[kind].map((s) => s.key).sort()).toEqual([...SECTIONS[kind]].sort());
  });

  test.each(["design", "proposal", "discovery"] as const)("%s: a version turned into fields and back is the same version", (kind) => {
    const fields = fieldsFrom(kind, parts[kind]);
    expect(contentFrom(kind, "en", fields)).toEqual(JSON.parse(JSON.stringify(parts[kind])));
    expect(validateArtifact(kind, contentFrom(kind, "en", fields), ctx).ok).toBe(true);
  });

  test("an edit is a structured change: emptied rows are dropped, added rows kept, and an assumption loses its quote", () => {
    const fields = fieldsFrom("design", parts.design);
    fields["assumptions.0.text"] = "";
    fields["assumptions.0.reason"] = "";
    fields["missing_information.1"] = "Who can cancel a booking";
    fields["goals.0.basis"] = "assumption";
    const content = contentFrom("design", "en", fields) as { assumptions: unknown[]; missing_information: string[]; goals: { basis: string; evidence?: string }[] };
    expect(content.assumptions).toEqual([]);
    expect(content.missing_information).toEqual(["How cancellations are handled today", "Who can cancel a booking"]);
    expect(content.goals[0]).toEqual({ text: "An online booking system for patients.", basis: "assumption" });
  });

  test("an edit goes through the same checks as automation: an invented figure or a quote not in the brief is refused", () => {
    const fields = fieldsFrom("proposal", parts.proposal);
    fields["proposal_direction.approach"] = "A first phase for $4,000.";
    const r = validateArtifact("proposal", contentFrom("proposal", "en", fields), ctx);
    expect(r.ok ? [] : r.problems.map((p) => p.kind)).toContain("unsupported_number");
    const design = fieldsFrom("design", parts.design);
    design["client_facts.0.evidence"] = "something the client never wrote";
    const d = validateArtifact("design", contentFrom("design", "en", design), ctx);
    expect(d.ok ? [] : d.problems.map((p) => p.kind)).toContain("ungrounded_fact");
  });

  test("choosing no pattern makes a hand-made design; screens are kept by position", () => {
    const fields = fieldsFrom("design", parts.design);
    expect(fields["design_blueprint.pattern"]).toBe("scheduling_app");
    fields["design_blueprint.pattern"] = "";
    const blueprint = (contentFrom("design", "en", fields) as { blueprint: { pattern: unknown } }).blueprint;
    expect(blueprint.pattern).toBeNull();
    const two = (contentFrom("design", "en", fieldsFrom("design", parts.design)) as { screens: { id: string }[] }).screens;
    expect(two.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  test("the choices follow the client's project type", () => {
    expect(optionValues("pattern", "mobile_app")).toEqual(["mobile_onboarding", "mobile_discovery", "mobile_transactions"]);
    expect(optionValues("proposal_pattern", "website")).toEqual(["website", "existing_product"]);
    expect(optionValues("template", "web_app", "scheduling_app")).toContain("confirmation");
    expect(optionValues("bank", null)).toHaveLength(12);
  });

  test("only the Pack's own field names are read from a posted form", () => {
    const form = new FormData();
    form.set("goals.0.text", "A goal");
    form.set("inquiryId", "x");
    form.set("__proto__.polluted", "x");
    form.set("goals.0.text\nbad", "x");
    expect(fieldsFromForm(form)).toEqual({ "goals.0.text": "A goal" });
  });
});
