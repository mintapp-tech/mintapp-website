import { describe, expect, test } from "vitest";
import { buildGenerationInput } from "@/lib/preparation/input";
import { knownDetails } from "@/lib/preparation/scrub";
import { SYNTHETIC_BRIEFS } from "@/lib/preparation/synthetic-briefs";
import { PATTERNS, PATTERN_IDS, TEMPLATES, catalogueText, kindFromProjectType } from "./patterns";
import { buildPackMessages, manualPackPrompt } from "./prompt";
import { renderableDesign, splitPack, validatePack, type PackResponse } from "./schema";
import { clinicPack } from "./test-fixtures";

const clinic = SYNTHETIC_BRIEFS[0];
const input = buildGenerationInput(clinic.inquiry);
const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };
const problems = (pack: unknown, c = ctx) => {
  const r = validatePack(pack, c);
  return r.ok ? [] : r.problems;
};

describe("the pattern library", () => {
  test("is small: five website, five web-app patterns and one mobile pattern with the seven mobile screens", () => {
    const by = (kind: string) => PATTERN_IDS.filter((id) => PATTERNS[id].kind === kind);
    expect(by("website")).toHaveLength(5);
    expect(by("web_app")).toHaveLength(5);
    expect(PATTERNS.mobile_app.templates).toEqual(["onboarding", "home", "list_search", "detail", "booking_order", "tracking", "profile"]);
  });
  test("every pattern only uses templates meant for its kind", () => {
    for (const id of PATTERN_IDS) for (const t of PATTERNS[id].templates) expect(TEMPLATES[t].kinds as readonly string[], `${id} ${t}`).toContain(PATTERNS[id].kind);
  });
  test("the client's own project type decides the kind; anything else leaves it open", () => {
    expect(kindFromProjectType("web_app")).toBe("web_app");
    expect(kindFromProjectType("not_sure")).toBeNull();
    expect(kindFromProjectType("other")).toBeNull();
    expect(catalogueText()).toContain("scheduling_app (web_app)");
  });
});

describe("pack validation", () => {
  test("accepts a pack whose facts quote the brief and whose design uses one pattern's templates", () => {
    expect(problems(clinicPack())).toEqual([]);
  });

  test("the response must have exactly the expected shape", () => {
    expect(problems({ ...clinicPack(), html: "<div/>" })[0]).toMatchObject({ kind: "schema" });
    expect(problems({ ...clinicPack(), discovery_questions: [] })[0]).toMatchObject({ kind: "schema" });
    const noProposal: Record<string, unknown> = { ...clinicPack() };
    delete noProposal.proposal;
    expect(problems(noProposal)[0]).toMatchObject({ kind: "schema" });
  });

  test("a client fact must quote the brief; assumptions are allowed to be inferences", () => {
    const pack = clinicPack({ client_facts: [{ text: "They want an AI assistant.", evidence: "We want an AI assistant" }] });
    expect(problems(pack)).toContainEqual({ kind: "ungrounded_fact", index: 0 });
  });

  test.each([
    ["an invented price in the proposal", { proposal: { ...clinicPack().proposal, next_step: "Propose a $4,000 first phase." } }],
    ["an invented duration in a phase", { proposal: { ...clinicPack().proposal, phases: [{ name: "Build", summary: "About 6 weeks of work." }] } }],
    ["an invented metric on a screen", { screens: [{ ...clinicPack().screens[0], headline: "Cut no-shows by 30%" }, clinicPack().screens[1]] }],
    ["an invented quantity in a question", { discovery_questions: [...clinicPack().discovery_questions, { question: "Do you need 12 user roles?", purpose: "Roles" }] }],
  ])("rejects %s", (_name, over) => {
    expect(problems(clinicPack(over as Partial<PackResponse>)).some((p) => p.kind === "unsupported_number")).toBe(true);
  });

  test("figures the client stated are fine (here: 3 months)", () => {
    expect(problems(clinicPack({ proposal: { ...clinicPack().proposal, next_step: "Plan around the client's 3 months." } }))).toEqual([]);
  });

  test("never a promise or a guarantee, in English or Arabic", () => {
    expect(problems(clinicPack({ proposal: { ...clinicPack().proposal, recommended_solution: "We guarantee bookings will double." } })).some((p) => p.kind === "commitment")).toBe(true);
    expect(problems(clinicPack({ proposal: { ...clinicPack().proposal, recommended_solution: "نضمن نجاح المشروع." } })).some((p) => p.kind === "commitment")).toBe(true);
  });

  test("only library patterns and templates; a pattern that contradicts the client's project type is refused", () => {
    expect(problems(clinicPack({ design_blueprint: { ...clinicPack().design_blueprint, pattern: "custom_react_page" as never } }))[0]).toMatchObject({ kind: "schema" });
    expect(problems(clinicPack({ screens: [{ ...clinicPack().screens[0], template: "AnyComponent" as never }, clinicPack().screens[1]] }))[0]).toMatchObject({ kind: "schema" });
    expect(problems(clinicPack({ screens: [{ ...clinicPack().screens[0], template: "hero" }, clinicPack().screens[1]] }))).toContainEqual({ kind: "template_not_in_pattern", screen: "s1", template: "hero" });
    expect(problems(clinicPack({ design_blueprint: { ...clinicPack().design_blueprint, pattern: "booking_site" } }))).toContainEqual({ kind: "pattern_kind", pattern: "booking_site" });
  });

  test("two to four screens, unique, with a flow through them", () => {
    expect(problems(clinicPack({ screens: [clinicPack().screens[0]] }))).toContainEqual({ kind: "screens", detail: "too_few" });
    expect(problems(clinicPack({ user_flow: [{ step: "Go", screen: "s1" }, { step: "Then", screen: "s4" }] }))).toContainEqual({ kind: "flow_screen", screen: "s4" });
    expect(problems(clinicPack({ screens: [clinicPack().screens[0], { ...clinicPack().screens[1], id: "s1" }] }))).toContainEqual({ kind: "screens", detail: "duplicate_ids" });
  });

  test("an unusual project falls back to a hand-made design: no pattern, a reason, no screens", () => {
    const manual = clinicPack({ design_blueprint: { ...clinicPack().design_blueprint, pattern: null, unsupported_reason: "A hardware product; no pattern fits." }, screens: [], user_flow: [] });
    expect(problems(manual)).toEqual([]);
    expect(problems({ ...manual, design_blueprint: { ...manual.design_blueprint, unsupported_reason: undefined } })).toContainEqual({ kind: "screens", detail: "unsupported_without_reason" });
  });

  test("the language must match the brief", () => {
    expect(problems(clinicPack({ language: "ar" }))).toContainEqual({ kind: "wrong_language" });
  });
});

describe("artifacts", () => {
  test("a pack splits into the initial design, the draft proposal and the discovery pack", () => {
    const parts = splitPack(clinicPack());
    expect(Object.keys(parts)).toEqual(["design", "proposal", "discovery"]);
    expect(parts.design.format).toBe("pack-design");
    expect(parts.design.screens).toHaveLength(2);
    expect(parts.proposal.proposal.exclusions).toContain("Payments");
    expect(parts.discovery.discovery_questions).toHaveLength(3);
    expect(parts.discovery.meeting_agenda).toHaveLength(2);
  });

  test("a stored design is re-checked before it is drawn: anything outside the library is not rendered", () => {
    const design = splitPack(clinicPack()).design;
    expect(renderableDesign(design)).not.toBeNull();
    expect(renderableDesign({ ...design, screens: [{ ...design.screens[0], template: "hero" }] })).toBeNull();
    expect(renderableDesign({ ...design, blueprint: { ...design.blueprint, pattern: "evil" } })).toBeNull();
    expect(renderableDesign({ format: "text", body: "<script>alert(1)</script>" })).toBeNull();
    expect(renderableDesign(null)).toBeNull();
  });
});

describe("what leaves Mintapp", () => {
  test("the model and the manual prompt get the scrubbed brief and the instructions, never contact details", () => {
    const withContacts = buildGenerationInput({
      ...clinic.inquiry,
      project_description: `${clinic.inquiry.project_description} Call Layla Hassan on +20 100 555 0101 or layla@cedar.example, www.cedar.example.`,
      redact: knownDetails({ client_name: "Layla Hassan", email: "layla@cedar.example", phone: "+20 100 555 0101", company_name: "Cedar Labs" }),
    });
    const sent = JSON.stringify(buildPackMessages(withContacts)) + manualPackPrompt(withContacts);
    expect(sent).not.toMatch(/Layla|Hassan|cedar|555 0101|@/i);
    expect(sent).toContain("three physiotherapy clinics");
    expect(sent).toContain("Pattern catalogue");
  });
});
