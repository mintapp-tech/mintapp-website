import { describe, expect, test } from "vitest";
import { buildGenerationInput } from "@/lib/preparation/input";
import { knownDetails } from "@/lib/preparation/scrub";
import { SYNTHETIC_BRIEFS } from "@/lib/preparation/synthetic-briefs";
import {
  COMPONENTS,
  DISCOVERY_BANK_IDS,
  FOUNDATION_RULES,
  LEGACY_PATTERNS,
  PATTERNS,
  PATTERN_IDS,
  PROPOSAL_PATTERN_IDS,
  QUALITY_RULES,
  RUBRIC,
  APPROVAL_CHECKLIST,
  TEMPLATES,
  TEMPLATE_IDS,
  catalogueText,
  kindFromProjectType,
} from "./library";
import { buildPackMessages, manualPackPrompt, packSystemPrompt } from "./prompt";
import { SECTION_KEYS, artifactFindings, blocksPresentation, classifyPack, joinPack, renderableDesign, splitPack, validateArtifact, validatePack, type Pack } from "./schema";
import { clinicPack } from "./test-fixtures";

const clinic = SYNTHETIC_BRIEFS[0];
const input = buildGenerationInput(clinic.inquiry);
const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };
const problems = (pack: unknown, c = ctx) => {
  const r = validatePack(pack, c);
  return r.ok ? [] : r.problems;
};
const kinds = (pack: unknown) => problems(pack).map((p) => p.kind);
const base = clinicPack();

describe("the design library", () => {
  test("twelve product patterns: five websites, four web applications, three mobile", () => {
    const by = (kind: string) => PATTERN_IDS.filter((id) => PATTERNS[id].kind === kind);
    expect(by("website")).toEqual(["studio_site", "saas_marketing", "marketplace_site", "academy_site", "booking_site"]);
    expect(by("web_app")).toEqual(["dashboard_app", "crm_app", "marketplace_admin", "scheduling_app"]);
    expect(by("mobile_app")).toEqual(["mobile_onboarding", "mobile_discovery", "mobile_transactions"]);
  });

  test("every pattern only uses templates meant for its kind, and every template is used", () => {
    for (const id of PATTERN_IDS) for (const t of PATTERNS[id].templates) expect(TEMPLATES[t].kinds as readonly string[], `${id} ${t}`).toContain(PATTERNS[id].kind);
    const used = new Set(PATTERN_IDS.flatMap((id) => PATTERNS[id].templates));
    expect(TEMPLATE_IDS.filter((t) => !used.has(t))).toEqual([]);
    expect(TEMPLATE_IDS).toHaveLength(26);
  });

  test("the first library's patterns stay drawable in history but are never offered", () => {
    expect(Object.keys(LEGACY_PATTERNS)).toEqual(["operations_app", "mobile_app"]);
    expect(catalogueText()).not.toMatch(/operations_app|\bmobile_app \(/);
  });

  test("foundations, components, proposal patterns, discovery banks, quality rules, rubric and checklist are complete", () => {
    expect(FOUNDATION_RULES.map((f) => f.id)).toEqual(["typography", "spacing", "grids", "colour", "borders", "elevation", "imagery", "motion", "accessibility", "bilingual"]);
    expect(COMPONENTS.map((c) => c.id)).toEqual(["navigation", "hero", "cards", "forms", "tables", "filters", "dashboards", "empty_states", "dialogs", "mobile_navigation", "bookings", "progress_status", "data_visualisation"]);
    for (const c of COMPONENTS) for (const t of c.templates) expect(TEMPLATE_IDS, c.id).toContain(t);
    expect(PROPOSAL_PATTERN_IDS).toEqual(["website", "web_app", "mobile_app", "existing_product"]);
    expect(DISCOVERY_BANK_IDS).toEqual(["project_type", "business_model", "users", "operations", "payments", "integrations", "roles_permissions", "content", "security_privacy", "analytics", "language", "support_maintenance"]);
    expect(QUALITY_RULES.map((r) => r.id)).toEqual(["no_decoration", "no_invented_proof", "no_placeholder", "library_only", "feasible", "responsive", "arabic_review", "calm_motion", "no_hidden_commitments"]);
    expect(RUBRIC.map((r) => r.id)).toEqual(["relevance", "clarity", "differentiation", "feasibility", "consistency", "accessibility", "responsiveness", "rtl", "evidence", "usefulness"]);
    for (const x of [...RUBRIC, ...APPROVAL_CHECKLIST]) expect(x.ar).toMatch(/[؀-ۿ]/);
  });

  test("the client's own project type decides the kind; anything else leaves it open", () => {
    expect(kindFromProjectType("web_app")).toBe("web_app");
    expect(kindFromProjectType("not_sure")).toBeNull();
    expect(catalogueText()).toContain("scheduling_app (web_app)");
  });
});

describe("pack validation", () => {
  test("accepts a pack whose facts quote the brief and whose design uses one pattern's templates", () => {
    expect(problems(base)).toEqual([]);
  });

  test("has exactly the seventeen sections, and nothing else", () => {
    expect(SECTION_KEYS).toEqual(["client_facts", "assumptions", "missing_information", "business_context", "users", "problem", "goals", "design_blueprint", "screens", "user_flow", "scope_direction", "proposal_direction", "discovery_questions", "decisions_needed", "risks", "meeting_agenda", "next_steps"]);
    expect(kinds({ ...base, html: "<div/>" })).toEqual(["schema"]);
    for (const key of SECTION_KEYS) {
      const without: Record<string, unknown> = { ...base };
      delete without[key];
      expect(kinds(without), key).toEqual(["schema"]);
    }
  });

  test.each([
    ["no client facts", { client_facts: [] }],
    ["too few discovery questions", { discovery_questions: base.discovery_questions.slice(0, 2) }],
    ["too many screens", { screens: [...base.screens, ...base.screens, { ...base.screens[0], id: "s5" }] }],
    ["no responsive direction", { design_blueprint: { ...base.design_blueprint, responsive_notes: "" } }],
    ["an empty agenda", { meeting_agenda: [base.meeting_agenda[0]] }],
    ["no next step", { next_steps: [] }],
    ["no first release", { scope_direction: { ...base.scope_direction, first_release: [] } }],
    ["a statement without a basis", { goals: [{ text: "A goal." }] }],
    ["a basis outside the two", { problem: [{ text: "A problem.", basis: "recommendation" }] }],
    ["an over-long fact", { client_facts: [{ text: "x".repeat(301), evidence: "Patients book by phone" }] }],
  ])("refuses %s (structure)", (_n, over) => {
    expect(kinds(clinicPack(over as Partial<Pack>))).toContain("schema");
  });

  test("facts and assumptions stay apart: a client fact, or any statement marked as one, must quote the brief", () => {
    expect(problems(clinicPack({ client_facts: [{ text: "They want an AI assistant.", evidence: "We want an AI assistant" }] }))).toContainEqual({ kind: "ungrounded_fact", section: "client_facts", index: 0 });
    expect(problems(clinicPack({ goals: [{ text: "Grow to ten clinics.", basis: "client_fact", evidence: "grow to ten clinics" }] }))).toContainEqual({ kind: "ungrounded_fact", section: "goals", index: 0 });
    // A client fact needs its quote.
    expect(problems(clinicPack({ users: [{ group: "Doctors", needs: "A view of their day.", basis: "client_fact" }] }))).toContainEqual({ kind: "ungrounded_fact", section: "users", index: 0 });
    // The same statement as our assumption needs no quote.
    expect(problems(clinicPack({ users: [{ group: "Doctors", needs: "A view of their day.", basis: "assumption" }] }))).toEqual([]);
  });

  test.each([
    ["an invented price in the proposal", { proposal_direction: { ...base.proposal_direction, approach: "A first phase for $4,000." } }],
    ["an invented duration in a phase", { proposal_direction: { ...base.proposal_direction, phases: [{ name: "Build", summary: "About 6 weeks of work." }] } }],
    ["an invented metric on a screen", { screens: [{ ...base.screens[0], headline: "Cut no-shows by 30%" }, base.screens[1]] }],
    ["an invented quantity in a question", { discovery_questions: [...base.discovery_questions, { question: "Do you need 12 user roles?", purpose: "Roles", bank: "roles_permissions" }] }],
    ["an invented figure in an assumption", { assumptions: [{ text: "About 200 patients a week.", reason: "A guess." }] }],
  ])("refuses %s", (_name, over) => {
    expect(kinds(clinicPack(over as Partial<Pack>))).toContain("unsupported_number");
  });

  test("figures the client stated are fine (here: 3 months)", () => {
    expect(problems(clinicPack({ next_steps: ["Plan around the client's 3 months."] }))).toEqual([]);
  });

  test("never a promise, a fixed price or a delivery date, in English or Arabic, assumptions included", () => {
    for (const text of ["We guarantee bookings will double.", "A fixed price for the first release.", "It will be delivered within the quarter.", "Revisions are free of charge."]) {
      expect(kinds(clinicPack({ proposal_direction: { ...base.proposal_direction, approach: text } })), text).toContain("commitment");
    }
    expect(kinds(clinicPack({ assumptions: [{ text: "We will deliver the app before launch.", reason: "Their timing." }] }))).toContain("commitment");
    expect(kinds(clinicPack({ risks: [{ risk: "نضمن نجاح المشروع.", why: "x" }] }))).toContain("commitment");
  });

  test("no invented proof: endorsements, awards and superlatives are refused", () => {
    for (const text of ["Trusted by clinics across Egypt", "Award-winning booking", "The #1 booking tool", "Read our testimonials"]) {
      expect(kinds(clinicPack({ screens: [{ ...base.screens[0], headline: text }, base.screens[1]] })), text).toContain("unsupported_claim");
    }
  });

  test("no markup, links or contact details anywhere", () => {
    for (const text of ["<b>Book</b>", "See https://example.com", "Write to team@clinic.example", "[Book](javascript:alert(1))"]) {
      expect(kinds(clinicPack({ decisions_needed: [text] })), text).toContain("markup");
    }
  });

  test("written in the brief's language and script", () => {
    expect(kinds(clinicPack({ language: "ar" }))).toContain("wrong_language");
    const arabicText = clinicPack({ scope_direction: { first_release: ["الحجز", "الجدول", "واجهة عربية"], later: ["التذكير"], not_included: ["الدفع", "السجلات"] }, next_steps: ["تأكيد القواعد"], decisions_needed: ["من يلغي الحجز"] });
    const r = { ...arabicText, risks: [{ risk: "استمرار الجدول القديم", why: "العادة" }], meeting_agenda: [{ item: "الحجز اليوم", purpose: "تأكيد" }, { item: "الإصدار الأول", purpose: "اتفاق" }], user_flow: base.user_flow.map((u) => ({ ...u, step: "خطوة" })), screens: base.screens.map((s) => ({ ...s, title: "شاشة", purpose: "غرض", headline: "عنوان", items: [{ title: "بند", text: "نص" }], primary_action: "تأكيد" })) };
    expect(kinds(r)).toContain("wrong_script");
  });

  test("only library patterns, templates, proposal patterns and discovery banks; the client's project type is respected", () => {
    expect(kinds(clinicPack({ design_blueprint: { ...base.design_blueprint, pattern: "custom_react_page" as never } }))).toEqual(["schema"]);
    expect(kinds(clinicPack({ screens: [{ ...base.screens[0], template: "AnyComponent" as never }, base.screens[1]] }))).toEqual(["schema"]);
    expect(kinds(clinicPack({ proposal_direction: { ...base.proposal_direction, pattern: "retainer" as never } }))).toEqual(["schema"]);
    expect(kinds(clinicPack({ discovery_questions: base.discovery_questions.map((q) => ({ ...q, bank: "gossip" as never })) }))).toEqual(["schema", "schema", "schema"]);
    expect(problems(clinicPack({ screens: [{ ...base.screens[0], template: "hero" }, base.screens[1]] }))).toContainEqual({ kind: "template_not_in_pattern", screen: "s1", template: "hero" });
    expect(problems(clinicPack({ design_blueprint: { ...base.design_blueprint, pattern: "booking_site" } }))).toContainEqual({ kind: "pattern_kind", pattern: "booking_site" });
    expect(problems(clinicPack({ proposal_direction: { ...base.proposal_direction, pattern: "mobile_app" } }))).toContainEqual({ kind: "proposal_kind", pattern: "mobile_app" });
    // An existing product suits any kind.
    expect(problems(clinicPack({ proposal_direction: { ...base.proposal_direction, pattern: "existing_product" } }))).toEqual([]);
  });

  test("two to four screens, unique, with a flow through them", () => {
    expect(problems(clinicPack({ screens: [base.screens[0]] }))).toContainEqual({ kind: "screens", detail: "too_few" });
    expect(problems(clinicPack({ user_flow: [{ step: "Go", screen: "s1" }, { step: "Then", screen: "s4" }] }))).toContainEqual({ kind: "flow_screen", screen: "s4" });
    expect(problems(clinicPack({ screens: [base.screens[0], { ...base.screens[1], id: "s1" }] }))).toContainEqual({ kind: "screens", detail: "duplicate_ids" });
  });

  test("an unusual project falls back to a hand-made design: no pattern, a reason, no screens; it can be saved, never presented", () => {
    const manual = clinicPack({ design_blueprint: { ...base.design_blueprint, pattern: null, unsupported_reason: "A hardware product; no pattern fits." }, screens: [], user_flow: [] });
    expect(problems(manual)).toEqual([]);
    expect(problems({ ...manual, design_blueprint: { ...manual.design_blueprint, unsupported_reason: undefined } })).toContainEqual({ kind: "screens", detail: "unsupported_without_reason" });
    const findings = artifactFindings("design", splitPack(manual).design);
    expect(findings).toContainEqual({ kind: "hand_design" });
    expect(blocksPresentation(findings)).toBe(true);
  });

  test("placeholder text can be saved and reviewed but blocks the presentation", () => {
    const parts = splitPack(clinicPack({ next_steps: ["[MOCK] Confirm the rules."] }));
    expect(validateArtifact("discovery", parts.discovery, ctx).ok).toBe(true);
    expect(artifactFindings("discovery", parts.discovery)).toContainEqual({ kind: "placeholder", section: "next_steps" });
    expect(blocksPresentation(artifactFindings("discovery", parts.discovery))).toBe(true);
    expect(blocksPresentation(artifactFindings("discovery", splitPack(base).discovery))).toBe(false);
  });
});

describe("every statement has one basis", () => {
  test("client fact, assumption, recommendation or question, for every word a person reads", () => {
    const statements = classifyPack(base);
    // Every string in the Pack that is not an id is classified once.
    const prose: string[] = [];
    const walk = (v: unknown, key = "") => {
      if (typeof v === "string") {
        if (!["id", "template", "pattern", "screen", "bank", "basis", "language"].includes(key)) prose.push(v);
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk(base);
    expect(statements.map((s) => s.text).sort()).toEqual(prose.sort());
    const basisOf = (text: string) => statements.find((s) => s.text === text)?.basis;
    expect(basisOf("Bookings happen by phone.")).toBe("client_fact");
    expect(basisOf("Patients book by phone")).toBe("client_fact");
    expect(basisOf("Receptionists will manage the schedule.")).toBe("assumption");
    expect(basisOf("The clinics share their receptionists' scheduling work.")).toBe("assumption");
    expect(basisOf("Three physiotherapy clinics in Cairo.")).toBe("client_fact");
    expect(basisOf("How cancellations are handled today")).toBe("question");
    expect(basisOf("How are cancellations handled today?")).toBe("question");
    expect(basisOf("Design the cancellation flow.")).toBe("recommendation");
    expect(basisOf("Patient booking by therapist and time")).toBe("recommendation");
    expect(basisOf("Receptionists may keep the spreadsheet in parallel.")).toBe("assumption");
    expect(new Set(statements.map((s) => s.basis))).toEqual(new Set(["client_fact", "assumption", "recommendation", "question"]));
  });
});

describe("artifacts", () => {
  test("a pack splits into the three working areas and joins back unchanged", () => {
    const parts = splitPack(base);
    expect(Object.keys(parts)).toEqual(["design", "proposal", "discovery"]);
    expect(parts.design).toMatchObject({ format: "pack-design", v: 2 });
    expect(parts.design.client_facts).toHaveLength(3);
    expect(parts.proposal.scope_direction.not_included).toContain("Payments");
    expect(parts.discovery.discovery_questions).toHaveLength(3);
    expect(joinPack(parts.design, parts.proposal, parts.discovery)).toEqual(base);
    for (const k of ["design", "proposal", "discovery"] as const) expect(validateArtifact(k, parts[k], ctx).ok, k).toBe(true);
  });

  test("a stored artifact is checked exactly as inside a pack", () => {
    const parts = splitPack(base);
    const bad = validateArtifact("design", { ...parts.design, client_facts: [{ text: "x", evidence: "not in the brief" }] }, ctx);
    expect(bad.ok ? [] : bad.problems).toContainEqual({ kind: "ungrounded_fact", section: "client_facts", index: 0 });
    expect(validateArtifact("proposal", { ...parts.proposal, extra: 1 }, ctx).ok).toBe(false);
  });

  test("a stored design is re-checked before it is drawn: anything outside the library is not rendered", () => {
    const design = splitPack(base).design;
    expect(renderableDesign(design)).toMatchObject({ pattern: "scheduling_app", kind: "web_app" });
    expect(renderableDesign({ ...design, screens: [{ ...design.screens[0], template: "hero" }] })).toBeNull();
    expect(renderableDesign({ ...design, blueprint: { ...design.blueprint, pattern: "evil" } })).toBeNull();
    expect(renderableDesign({ format: "text", body: "<script>alert(1)</script>" })).toBeNull();
    expect(renderableDesign(null)).toBeNull();
  });

  test("a first-format design (and its legacy pattern) is still drawn in the history", () => {
    const legacy = { format: "pack-design", v: 1, language: "en", blueprint: { pattern: "operations_app", audience: "A team", primary_goal: "Move jobs", hierarchy: ["Board"], responsive_notes: "Phones", brand_context: "None" }, screens: [base.screens[0], { ...base.screens[1], template: "workflow_board" }].map((s, i) => ({ ...s, template: i === 0 ? "record_table" : "workflow_board" })), user_flow: base.user_flow };
    expect(renderableDesign(legacy)).toMatchObject({ pattern: "operations_app", notes: { audience: "A team" } });
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
  });

  test("the instructions carry the whole shape and every catalogue", () => {
    const prompt = packSystemPrompt("en");
    for (const key of SECTION_KEYS) expect(prompt, key).toContain(`"${key}"`);
    for (const id of [...PATTERN_IDS, ...PROPOSAL_PATTERN_IDS, ...DISCOVERY_BANK_IDS]) expect(prompt, id).toContain(id);
    expect(packSystemPrompt("ar")).toContain('"language" to "ar"');
  });
});
