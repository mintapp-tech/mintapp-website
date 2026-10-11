// Foundations of Mintapp's design library: the one visual system every concept
// screen is drawn in, and the written rules behind it. The tokens are neutral on
// purpose (no client brand is assumed and nothing is fetched), so the conversation
// is about structure, not colour. Every value here is code-owned; a model never
// supplies styles.

export const FOUNDATIONS = {
  // Type: one sans family (the admin's own fonts), a short modular scale.
  type: { display: "text-[26px] leading-tight font-bold tracking-[-0.01em]", title: "text-[18px] leading-snug font-semibold", body: "text-[14px] leading-relaxed", small: "text-[12.5px] leading-snug", label: "text-[11.5px] font-semibold uppercase tracking-[0.06em]" },
  // Spacing on a 4px grid; sections breathe at 24-32px.
  space: { section: "px-6 py-7", tight: "px-4 py-4", gap: "gap-3", stack: "space-y-3" },
  // A 12-column desktop grid, 4 columns on a phone.
  grid: { desktop: "grid grid-cols-12 gap-4", phone: "grid grid-cols-4 gap-3" },
  // Colour usage: ink on paper, one accent for the primary action only.
  colour: {
    page: "bg-[#fbfbf9] text-[#1d2420]",
    panel: "bg-white",
    muted: "text-[#5a635e]",
    line: "border-[#e2e6e3]",
    accent: "bg-[#1f6f5c] text-white",
    accentText: "text-[#1f6f5c]",
    placeholder: "bg-[#eef1ee] text-[#5a635e]",
    dim: "bg-[#1d2420]/40",
  },
  radius: { card: "rounded-xl", control: "rounded-lg", pill: "rounded-full", frame: "rounded-2xl" },
  shadow: { card: "shadow-[0_1px_2px_rgba(20,30,25,0.06)]", frame: "shadow-[0_12px_32px_rgba(20,30,25,0.12)]", dialog: "shadow-[0_18px_48px_rgba(20,30,25,0.22)]" },
  // Motion: none. Concept screens and the Direction Pack are static, so they are
  // identical with reduced motion.
  motion: "motion-reduce:transition-none",
} as const;

export type Frame = "desktop" | "phone";

export interface FoundationRule {
  id: string;
  en: string;
  ar: string;
  rules: string[];
}

// The written foundations: what every concept screen and presentation follows.
export const FOUNDATION_RULES: FoundationRule[] = [
  {
    id: "typography",
    en: "Typography",
    ar: "الخطوط",
    rules: [
      "One sans family in two weights for text and one bolder weight for headings; no decorative display faces.",
      "A short scale: display 26, title 18, body 14, small 12.5 on screens; presentation sizes scale with the slide.",
      "Line length 45-75 characters for reading text; headings in sentence case.",
      "Arabic uses the same scale with more line height and no letter-spacing; never italic or all-caps for Arabic.",
    ],
  },
  {
    id: "spacing",
    en: "Spacing",
    ar: "المسافات",
    rules: ["A 4px base; component padding 12-16, section padding 24-32.", "Related things sit closer than unrelated things; space, not lines, groups content first."],
  },
  {
    id: "grids",
    en: "Responsive grids",
    ar: "الشبكات المتجاوبة",
    rules: [
      "Desktop 12 columns, tablet 8, phone 4. Every web concept is drawn at desktop and phone width.",
      "Cards collapse to one column on phones; tables become stacked rows; side navigation becomes a top bar or a bottom tab bar.",
      "Nothing may scroll sideways at 320px except a deliberately scrollable table region with a label.",
    ],
  },
  {
    id: "colour",
    en: "Colour and contrast",
    ar: "الألوان والتباين",
    rules: [
      "Ink on paper with one accent, used only for the primary action and the current state.",
      "Body text at least 4.5:1 against its background; large text and interface outlines at least 3:1.",
      "Colour never carries meaning alone: a status also has a word or an icon.",
      "No client brand is assumed in concepts; brand colour is applied only from approved brand material.",
    ],
  },
  {
    id: "borders",
    en: "Borders and radius",
    ar: "الحدود والزوايا",
    rules: ["Hairline borders (1px, low contrast) separate panels; radius 8 for controls, 12 for cards, 16 for frames.", "One radius family per screen; pills only for chips and status."],
  },
  {
    id: "elevation",
    en: "Shadows and elevation",
    ar: "الظلال والارتفاع",
    rules: ["Three levels only: flat (page), raised (cards: a 1-2px shadow), overlay (dialogs and frames).", "Elevation means 'above' (a dialog, a menu), never decoration."],
  },
  {
    id: "imagery",
    en: "Imagery",
    ar: "الصور",
    rules: [
      "Concepts use labelled placeholders, never stock photos, generated images or images from the web.",
      "A placeholder says what would go there; real imagery comes from the client's approved material and its licence is recorded.",
      "No people, logos or products that are not the client's own.",
    ],
  },
  {
    id: "motion",
    en: "Purposeful motion",
    ar: "الحركة الهادفة",
    rules: [
      "Motion only to show a change of state or place (an item added, a panel opened), 150-250ms, no bounce.",
      "Nothing moves on its own; nothing loops. With reduced motion everything is instant.",
      "Concept screens and the Direction Pack are static.",
    ],
  },
  {
    id: "accessibility",
    en: "Accessibility",
    ar: "إتاحة الوصول",
    rules: [
      "WCAG 2.1 AA: contrast, visible focus, labels for every field, headings in order, keyboard reachable.",
      "Touch targets at least 44 by 44 on phones; error messages say what to do next.",
      "Placeholders and decorative shapes are hidden from screen readers.",
    ],
  },
  {
    id: "bilingual",
    en: "English and Arabic (right to left)",
    ar: "العربية والإنجليزية (من اليمين إلى اليسار)",
    rules: [
      "Layouts use logical start and end, so a design mirrors; directional icons (arrows, progress) flip, logos and numbers do not.",
      "Arabic copy is written in Arabic, not translated word for word, and reviewed by a fluent reader before a client sees it.",
      "Mixed-direction text (names, codes, URLs) is isolated so it reads correctly in either direction.",
      "Western digits are used unless the client asks otherwise; dates follow the reader's language.",
    ],
  },
];
