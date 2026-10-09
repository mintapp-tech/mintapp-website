// Foundations of the initial-design renderer: the one visual system every
// generated first direction is drawn in. Neutral on purpose (no client brand is
// assumed and nothing is fetched), so the conversation is about structure, not
// colour. Every value here is code-owned; a model never supplies styles.

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
  },
  radius: { card: "rounded-xl", control: "rounded-lg", pill: "rounded-full", frame: "rounded-2xl" },
  shadow: { card: "shadow-[0_1px_2px_rgba(20,30,25,0.06)]", frame: "shadow-[0_12px_32px_rgba(20,30,25,0.12)]" },
  // Motion: none. The preview is static, so it is identical with reduced motion.
  motion: "motion-reduce:transition-none",
  // Accessibility: text colours above meet 4.5:1 on white and on the page colour;
  // placeholders are decorative (aria-hidden) and say what would go there.
  // Arabic and RTL: layouts use logical properties (start/end), so a design in
  // Arabic mirrors without separate templates.
} as const;

export type Frame = "desktop" | "phone";
