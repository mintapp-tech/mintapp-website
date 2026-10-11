import { DISCOVERY_BANKS, PROPOSAL_PATTERNS, patternInfo, type DiscoveryBankId, type ProposalPatternId } from "./library";
import type { Lang } from "./labels";
import { PRESENTATION_COPY } from "./presentation-copy";
import type { Pack } from "./schema";

// The Direction Pack as an ordered list of slides, from one Pack. Pure, so the
// order, the content and the pagination are unit-tested; the components in
// src/components/pack/DirectionPack.tsx only draw what this returns.
//
// Slides are laid out on a fixed 1280 x 720 stage. A list that would not fit its
// column continues on a further slide ("continued") instead of being clipped: each
// item's height is estimated from its length, conservatively, and the browser tests
// check the real rendering for overflow at the longest content the schema allows.

export const STAGE = { width: 1280, height: 720 } as const;

export type Tag = "client_fact" | "assumption";
export interface SlideItem {
  text: string;
  label?: string;
  note?: string;
  tag?: Tag;
}
export interface SlideColumn {
  heading: string;
  items: SlideItem[];
  // Numbered list (agenda, journey) instead of bullets.
  numbered?: boolean;
  // The number of the first item, when a numbered list continues.
  start?: number;
}

export type Slide =
  | { kind: "cover" }
  | { kind: "columns"; title: string; continued: boolean; columns: SlideColumn[]; banner?: boolean; empty?: string }
  | { kind: "direction"; title: string; pattern: string; direction: string; hierarchy: string[]; responsive: string; brand: string }
  | { kind: "screen"; title: string; index: number; total: number; screen: Pack["screens"][number] };

// Column widths on the stage (px) and the height a column's items may use.
const WIDTH = { 1: 1152, 2: 552, 3: 352 } as const;
const BODY = 430;
const BODY_WITH_BANNER = 360;

// Conservative text metrics: a glyph is at most ~0.56 of the font size wide on
// average, and Arabic lines are taller.
const lineHeight = (font: number, lang: Lang) => font * (lang === "ar" ? 1.75 : 1.5);
const linesOf = (text: string, width: number, font: number) => Math.max(1, Math.ceil((text.length * font * 0.56) / width));

export function itemHeight(item: SlideItem, width: number, lang: Lang): number {
  const main = linesOf(item.label ? `${item.label}: ${item.text}` : item.text, width - 28, 19) * lineHeight(19, lang);
  const note = item.note ? linesOf(item.note, width - 28, 15) * lineHeight(15, lang) + 4 : 0;
  const tag = item.tag ? lineHeight(13, lang) + 4 : 0;
  return main + note + tag + 18;
}

// Splits one column's items into pages that each fit `budget`.
export function paginate(items: SlideItem[], width: number, budget: number, lang: Lang): SlideItem[][] {
  const pages: SlideItem[][] = [];
  let page: SlideItem[] = [];
  let used = 0;
  for (const item of items) {
    const h = itemHeight(item, width, lang);
    if (page.length && used + h > budget) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(item);
    used += h;
  }
  if (page.length || !pages.length) pages.push(page);
  return pages;
}

// One logical slide with N columns, continued over as many slides as its longest column needs.
function columnsSlides(lang: Lang, title: string, columns: SlideColumn[], opts: { banner?: boolean; empty?: string } = {}): Slide[] {
  const cols = columns.filter((c) => c.items.length > 0);
  if (!cols.length) return opts.empty ? [{ kind: "columns", title, continued: false, columns: [], ...opts }] : [];
  const width = WIDTH[Math.min(cols.length, 3) as 1 | 2 | 3];
  const budget = (opts.banner ? BODY_WITH_BANNER : BODY) - 40;
  const pages = cols.map((c) => paginate(c.items, width, budget, lang));
  const count = Math.max(...pages.map((p) => p.length));
  return Array.from({ length: count }, (_, i) => ({
    kind: "columns" as const,
    title,
    continued: i > 0,
    banner: opts.banner,
    columns: cols.map((c, j) => ({ ...c, items: pages[j][i] ?? [], start: c.numbered ? 1 + pages[j].slice(0, i).reduce((n, p) => n + p.length, 0) : undefined })),
  }));
}

const tagged = (s: { text: string; basis: Tag }): SlideItem => ({ text: s.text, tag: s.basis });

export function buildSlides(pack: Pack): Slide[] {
  const lang = pack.language;
  const c = PRESENTATION_COPY[lang];
  const L = c.labels;
  const b = pack.design_blueprint;
  const info = b.pattern ? patternInfo(b.pattern) : null;
  const order = new Map(pack.screens.map((s, i) => [s.id, i + 1]));
  const p = pack.proposal_direction;

  return [
    { kind: "cover" },
    ...columnsSlides(lang, c.slides.understood, [
      { heading: L.business, items: pack.business_context.map(tagged) },
      { heading: L.problem, items: pack.problem.map(tagged) },
    ]),
    ...columnsSlides(lang, c.slides.people, [
      { heading: L.users, items: pack.users.map((u) => ({ label: u.group, text: u.needs, tag: u.basis })) },
      { heading: L.goals, items: pack.goals.map(tagged) },
    ]),
    ...columnsSlides(lang, c.slides.factsAssumptions, [
      { heading: L.told, items: pack.client_facts.map((f) => ({ text: f.text })) },
      { heading: L.assume, items: pack.assumptions.map((a) => ({ text: a.text, note: a.reason })) },
      { heading: L.learn, items: pack.missing_information.map((m) => ({ text: m })) },
    ]),
    { kind: "direction", title: c.slides.direction, pattern: info ? info[lang] : "", direction: b.direction, hierarchy: b.hierarchy, responsive: b.responsive_notes, brand: b.brand_context },
    ...pack.screens.map((screen, i) => ({ kind: "screen" as const, title: c.slides.screen(i + 1, pack.screens.length), index: i + 1, total: pack.screens.length, screen })),
    ...columnsSlides(lang, c.slides.flow, [{ heading: "", numbered: true, items: pack.user_flow.map((u) => ({ text: u.step, note: pack.screens[(order.get(u.screen) ?? 1) - 1]?.title })) }]),
    ...columnsSlides(lang, c.slides.scope, [
      { heading: L.firstRelease, items: pack.scope_direction.first_release.map((text) => ({ text })) },
      { heading: L.later, items: pack.scope_direction.later.map((text) => ({ text })) },
      { heading: L.notIncluded, items: pack.scope_direction.not_included.map((text) => ({ text })) },
    ]),
    ...columnsSlides(
      lang,
      c.slides.proposal,
      [
        { heading: `${L.approach} · ${PROPOSAL_PATTERNS[p.pattern as ProposalPatternId][lang]}`, items: [{ text: p.approach }] },
        { heading: L.phases, numbered: true, items: p.phases.map((ph) => ({ label: ph.name, text: ph.summary })) },
      ],
      { banner: true },
    ),
    ...columnsSlides(
      lang,
      c.slides.proposal,
      [
        { heading: L.deliverables, items: p.deliverables.map((text) => ({ text })) },
        { heading: L.factors, items: p.cost_schedule_factors.map((text) => ({ text })) },
      ],
      { banner: true },
    ),
    ...columnsSlides(lang, c.slides.questions, [
      { heading: L.questions, items: pack.discovery_questions.map((q) => ({ text: q.question, note: DISCOVERY_BANKS[q.bank as DiscoveryBankId][lang] })) },
      { heading: L.decisions, items: pack.decisions_needed.map((text) => ({ text })) },
    ]),
    ...columnsSlides(lang, c.slides.risks, [{ heading: L.risks, items: pack.risks.map((r) => ({ text: r.risk, note: r.why })) }], { empty: c.noRisks }),
    ...columnsSlides(lang, c.slides.agenda, [
      { heading: L.agenda, numbered: true, items: pack.meeting_agenda.map((a) => ({ text: a.item, note: a.purpose })) },
      { heading: L.next, items: pack.next_steps.map((text) => ({ text })) },
    ]),
  ];
}
