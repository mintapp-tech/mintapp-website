import { describe, expect, test } from "vitest";
import { artifactLanguage, artifactLines, artifactView, compareVersions, legacyArtifactSections } from "./text";
import { splitPack } from "./schema";
import { clinicPack } from "./test-fixtures";

const parts = splitPack(clinicPack());

describe("a version for people to read", () => {
  test("the structured view keeps every statement with its basis, and never shows internal names", () => {
    const view = artifactView("design", parts.design, "en")!;
    expect(view.map((s) => s.key)).toEqual(["client_facts", "business_context", "users", "problem", "goals", "assumptions", "missing_information", "design_blueprint", "screens", "user_flow"]);
    const facts = view.find((s) => s.key === "client_facts")!;
    expect(facts.items[0]).toMatchObject({ text: "Bookings happen by phone.", basis: "client_fact", note: { field: "evidence", text: "Patients book by phone" } });
    const context = view.find((s) => s.key === "business_context")!;
    expect(context.items.map((i) => i.basis)).toEqual(["client_fact", "assumption"]);
    // The pattern is named, not shown by its id.
    expect(JSON.stringify(view)).toContain("Scheduling system");
    expect(JSON.stringify(view)).not.toContain("scheduling_app");
  });

  test("scope, proposal and the meeting plan read in either interface language", () => {
    const scope = artifactView("proposal", parts.proposal, "ar")!;
    expect(JSON.stringify(scope)).toContain("تطبيق ويب");
    const meeting = artifactView("discovery", parts.discovery, "en")!;
    expect(meeting.find((s) => s.key === "discovery_questions")!.items[0].note!.text).toContain("Operations");
  });

  test("an older format or a text version has no structured view; the first format stays readable", () => {
    expect(artifactView("design", { format: "text", body: "x" }, "en")).toBeNull();
    const legacy = { format: "pack-proposal", v: 1, language: "en", proposal: { understanding: "U", recommended_solution: "S", first_release_scope: ["A"], phases: [], deliverables: ["D"], assumptions: [], exclusions: [], cost_schedule_factors: ["F"], next_step: "N" } };
    expect(artifactView("proposal", legacy, "en")).toBeNull();
    expect(legacyArtifactSections(legacy)!.map((s) => s.title)).toContain("First release scope");
    expect(legacyArtifactSections(parts.proposal)).toBeNull();
  });

  test("plain lines cover every version format", () => {
    expect(artifactLines("discovery", parts.discovery, "en")).toContain("Questions for the meeting · Topic: How are cancellations handled today?");
    expect(artifactLines("design", { format: "text", body: "Line one\n\nLine two" }, "en")).toEqual(["Line one", "Line two"]);
    expect(artifactLines("design", null, "en")).toEqual([]);
  });

  test("comparing two versions lists what was added and removed, ignoring order", () => {
    const next = splitPack(clinicPack({ decisions_needed: ["Who can cancel a booking", "Whether therapists see patient notes"], next_steps: ["Confirm the booking rules after the meeting."] })).discovery;
    const change = compareVersions("discovery", parts.discovery, next, "en");
    expect(change.added).toEqual(["Decisions the client needs to make: Whether therapists see patient notes"]);
    expect(change.removed).toEqual([]);
    const reordered = { ...parts.discovery, discovery_questions: [...parts.discovery.discovery_questions].reverse() };
    expect(compareVersions("discovery", parts.discovery, reordered, "en")).toEqual({ added: [], removed: [] });
  });

  test("the language of a version is read from it, and is unknown for text", () => {
    expect(artifactLanguage(parts.design)).toBe("en");
    expect(artifactLanguage({ format: "text", body: "x" })).toBeNull();
  });
});
