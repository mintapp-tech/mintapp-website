import { DISCOVERY_BANK_IDS, PATTERN_IDS, PATTERNS, PROPOSAL_PATTERN_IDS, TEMPLATE_IDS, kindFromProjectType } from "./library";
import { ARTIFACT_FORMATS, PACK_FORMAT_VERSION, SECTION_KEYS, type ArtifactKind, type SectionKey } from "./schema";

// Editing a Pack version section by section, as a form: every section of an
// artifact is a group of labelled fields (rows for lists of statements, one field per
// line for plain lists). Saving builds the structured version from the fields and
// sends it through the same validator as automation; nothing is free text. The one
// spec below drives both the form (the Pack tab) and the parser. Pure.

export type InputKind = "text" | "textarea" | "select";
export type OptionSource = "basis" | "bank" | "pattern" | "proposal_pattern" | "template" | "screen";

export interface EditorInput {
  name: string;
  input: InputKind;
  max: number;
  optional?: boolean;
  options?: OptionSource;
}

export type EditorSection =
  | { key: SectionKey; type: "rows"; min: number; max: number; fields: EditorInput[] }
  | { key: SectionKey; type: "lines"; min: number; max: number; length: number }
  | { key: SectionKey; type: "group"; parts: ({ kind: "field" } & EditorInput | { kind: "lines"; name: string; min: number; max: number; length: number })[] }
  | { key: "screens"; type: "screens" };

const t = (name: string, max: number, optional = false): EditorInput => ({ name, input: max > 160 ? "textarea" : "text", max, optional });
const sel = (name: string, options: OptionSource, optional = false): EditorInput => ({ name, input: "select", max: 40, options, optional });

export const EDITOR: Record<ArtifactKind, EditorSection[]> = {
  design: [
    { key: "client_facts", type: "rows", min: 1, max: 12, fields: [t("text", 300), t("evidence", 300)] },
    { key: "business_context", type: "rows", min: 1, max: 4, fields: [t("text", 300), sel("basis", "basis"), t("evidence", 300, true)] },
    { key: "users", type: "rows", min: 1, max: 4, fields: [t("group", 80), t("needs", 240), sel("basis", "basis"), t("evidence", 300, true)] },
    { key: "problem", type: "rows", min: 1, max: 4, fields: [t("text", 300), sel("basis", "basis"), t("evidence", 300, true)] },
    { key: "goals", type: "rows", min: 1, max: 5, fields: [t("text", 300), sel("basis", "basis"), t("evidence", 300, true)] },
    { key: "assumptions", type: "rows", min: 0, max: 10, fields: [t("text", 300), t("reason", 300)] },
    { key: "missing_information", type: "lines", min: 0, max: 10, length: 200 },
    {
      key: "design_blueprint",
      type: "group",
      parts: [
        { kind: "field", ...sel("pattern", "pattern", true) },
        { kind: "field", ...t("unsupported_reason", 240, true) },
        { kind: "field", ...t("direction", 400) },
        { kind: "lines", name: "hierarchy", min: 1, max: 6, length: 200 },
        { kind: "field", ...t("responsive_notes", 300) },
        { kind: "field", ...t("brand_context", 240) },
      ],
    },
    { key: "screens", type: "screens" },
    { key: "user_flow", type: "rows", min: 0, max: 6, fields: [t("step", 160), sel("screen", "screen")] },
  ],
  proposal: [
    {
      key: "scope_direction",
      type: "group",
      parts: [
        { kind: "lines", name: "first_release", min: 1, max: 8, length: 200 },
        { kind: "lines", name: "later", min: 0, max: 6, length: 200 },
        { kind: "lines", name: "not_included", min: 0, max: 8, length: 200 },
      ],
    },
    {
      key: "proposal_direction",
      type: "group",
      parts: [
        { kind: "field", ...sel("pattern", "proposal_pattern") },
        { kind: "field", ...t("approach", 600) },
        { kind: "lines", name: "deliverables", min: 1, max: 8, length: 200 },
        { kind: "lines", name: "cost_schedule_factors", min: 1, max: 8, length: 240 },
      ],
    },
    // Phases are rows of a group field; kept as their own section in the form.
  ],
  discovery: [
    { key: "discovery_questions", type: "rows", min: 3, max: 10, fields: [t("question", 250), t("purpose", 250), sel("bank", "bank")] },
    { key: "decisions_needed", type: "lines", min: 0, max: 6, length: 200 },
    { key: "risks", type: "rows", min: 0, max: 6, fields: [t("risk", 240), t("why", 240)] },
    { key: "meeting_agenda", type: "rows", min: 2, max: 8, fields: [t("item", 120), t("purpose", 200)] },
    { key: "next_steps", type: "lines", min: 1, max: 5, length: 240 },
  ],
};

// The proposal's phases: rows inside proposal_direction.
export const PHASE_ROWS = { min: 1, max: 4, fields: [t("name", 80), t("summary", 300)] };
export const SCREEN_FIELDS = { fields: [sel("template", "template"), t("title", 80), t("purpose", 240), t("headline", 120), t("supporting_text", 240, true), t("primary_action", 40, true), t("secondary_action", 40, true)], items: 6 };

export type Fields = Record<string, string>;

// The choices offered by a select, given what the client chose on the form.
export function optionValues(source: OptionSource, projectType: string | null, pattern?: string | null): string[] {
  const kind = kindFromProjectType(projectType);
  switch (source) {
    case "basis":
      return ["client_fact", "assumption"];
    case "bank":
      return [...DISCOVERY_BANK_IDS];
    case "pattern":
      return PATTERN_IDS.filter((id) => !kind || PATTERNS[id].kind === kind);
    case "proposal_pattern":
      return PROPOSAL_PATTERN_IDS.filter((id) => !kind || id === kind || id === "existing_product");
    case "template":
      return pattern && Object.hasOwn(PATTERNS, pattern) ? [...PATTERNS[pattern as keyof typeof PATTERNS].templates] : [...TEMPLATE_IDS];
    case "screen":
      return ["s1", "s2", "s3", "s4"];
  }
}

// ----- Content -> fields (to fill the form)

/* eslint-disable @typescript-eslint/no-explicit-any -- content is walked generically by the spec */
export function fieldsFrom(kind: ArtifactKind, content: unknown): Fields {
  const c = (content ?? {}) as any;
  const out: Fields = {};
  const put = (name: string, value: unknown) => {
    if (typeof value === "string" && value !== "") out[name] = value;
  };
  const section = (key: string) => (key === "design_blueprint" ? c.blueprint : c[key]);
  for (const s of EDITOR[kind]) {
    const v = section(s.key);
    if (s.type === "rows") (v ?? []).forEach((row: any, i: number) => s.fields.forEach((f) => put(`${s.key}.${i}.${f.name}`, row?.[f.name])));
    else if (s.type === "lines") (v ?? []).forEach((line: unknown, i: number) => put(`${s.key}.${i}`, line));
    else if (s.type === "group") {
      for (const p of s.parts) {
        if (p.kind === "field") put(`${s.key}.${p.name}`, v?.[p.name]);
        else (v?.[p.name] ?? []).forEach((line: unknown, i: number) => put(`${s.key}.${p.name}.${i}`, line));
      }
    } else {
      (c.screens ?? []).forEach((sc: any) => {
        const i = Number(String(sc.id).slice(1)) - 1;
        if (!(i >= 0 && i < 4)) return;
        SCREEN_FIELDS.fields.forEach((f) => put(`screens.${i}.${f.name}`, sc[f.name]));
        (sc.items ?? []).forEach((it: any, j: number) => (put(`screens.${i}.items.${j}.title`, it.title), put(`screens.${i}.items.${j}.text`, it.text)));
      });
    }
  }
  if (kind === "proposal") (c.proposal_direction?.phases ?? []).forEach((ph: any, i: number) => PHASE_ROWS.fields.forEach((f) => put(`proposal_direction.phases.${i}.${f.name}`, ph[f.name])));
  if (kind === "design" && c.blueprint && c.blueprint.pattern === null) out["design_blueprint.pattern"] = "";
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ----- Fields -> content (what is validated and saved)

const get = (fields: Fields, name: string) => (fields[name] ?? "").trim();

function rows(fields: Fields, prefix: string, max: number, inputs: EditorInput[]) {
  const out: Record<string, string>[] = [];
  for (let i = 0; i < max + 2; i++) {
    const row: Record<string, string> = {};
    for (const f of inputs) {
      const v = get(fields, `${prefix}.${i}.${f.name}`);
      if (v) row[f.name] = v;
    }
    // A row is kept when anyone typed in it; a basis alone (a select's default) is not typing.
    const typed = Object.keys(row).some((k) => k !== "basis" && k !== "bank" && k !== "screen" && k !== "template");
    if (typed) out.push(row);
  }
  return out;
}

function lines(fields: Fields, prefix: string, max: number) {
  const out: string[] = [];
  for (let i = 0; i < max + 2; i++) {
    const v = get(fields, `${prefix}.${i}`);
    if (v) out.push(v);
  }
  return out;
}

// The structured version the fields describe, ready for validateArtifact. Rows a
// founder emptied are dropped; a statement the client said keeps its quote, an
// assumption drops it.
export function contentFrom(kind: ArtifactKind, language: "en" | "ar", fields: Fields): Record<string, unknown> {
  const content: Record<string, unknown> = { format: ARTIFACT_FORMATS[kind], v: PACK_FORMAT_VERSION, language };
  for (const s of EDITOR[kind]) {
    const target = s.key === "design_blueprint" ? "blueprint" : s.key;
    if (s.type === "rows") {
      content[target] = rows(fields, s.key, s.max, s.fields).map((r) => (r.basis === "assumption" ? { ...r, evidence: undefined } : r)).map((r) => JSON.parse(JSON.stringify(r)));
    } else if (s.type === "lines") content[target] = lines(fields, s.key, s.max);
    else if (s.type === "group") {
      const g: Record<string, unknown> = {};
      for (const p of s.parts) {
        if (p.kind === "lines") g[p.name] = lines(fields, `${s.key}.${p.name}`, p.max);
        else {
          const v = get(fields, `${s.key}.${p.name}`);
          if (v) g[p.name] = v;
          else if (s.key === "design_blueprint" && p.name === "pattern") g.pattern = null;
        }
      }
      if (s.key === "proposal_direction") g.phases = rows(fields, "proposal_direction.phases", PHASE_ROWS.max, PHASE_ROWS.fields);
      if (s.key === "design_blueprint" && g.pattern !== null) delete g.unsupported_reason;
      content[target] = g;
    } else {
      const screens: Record<string, unknown>[] = [];
      for (let i = 0; i < 4; i++) {
        const sc: Record<string, unknown> = { id: `s${i + 1}` };
        let typed = false;
        for (const f of SCREEN_FIELDS.fields) {
          const v = get(fields, `screens.${i}.${f.name}`);
          if (v) {
            sc[f.name] = v;
            if (f.name !== "template") typed = true;
          }
        }
        const items: { title: string; text: string }[] = [];
        for (let j = 0; j < SCREEN_FIELDS.items; j++) {
          const title = get(fields, `screens.${i}.items.${j}.title`);
          const text = get(fields, `screens.${i}.items.${j}.text`);
          if (title || text) items.push({ title, text });
        }
        sc.items = items;
        if (typed || items.length) screens.push(sc);
      }
      content.screens = screens;
    }
  }
  return content;
}

// The fields a form posted, keyed by name: only names under one of the Pack's own sections.
const SECTION_NAMES = new Set<string>(SECTION_KEYS);
export function fieldsFromForm(form: FormData): Fields {
  const out: Fields = {};
  for (const [name, value] of form.entries()) {
    if (typeof value !== "string" || value.length > 2000 || !/^[a-z_]+(\.[a-z0-9_]+)+$/.test(name)) continue;
    if (SECTION_NAMES.has(name.split(".")[0])) out[name] = value;
  }
  return out;
}
