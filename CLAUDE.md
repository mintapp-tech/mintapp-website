# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Not stock Next.js

This repo pins `next@16.2.12`, a version with breaking changes vs. training-data Next.js — conventions and APIs may differ. Before touching routing, middleware, caching, or config, check `node_modules/next/dist/docs/` (mirrors nextjs.org docs for this exact version). One confirmed deviation: **middleware is `src/proxy.ts` exporting `proxy()`**, not `middleware.ts`/`export function middleware()`.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npm test` — Vitest unit tests; `npm run test:e2e` — Playwright.
- Pushing to `mintapp-tech/mintapp-website` requires the `adamcoder2` GitHub account — the other account logged into `gh` (`arrentio`) lacks push access and pushes 403. `gh auth switch -u adamcoder2` if a push fails.

## Architecture

**Bilingual site (ar/en), locale-prefixed routing.** Every public page lives under `src/app/[locale]/...` (e.g. `/ar/services`, `/en/work/kwayes`). Arabic is the default locale (`DEFAULT_LOCALE` in `src/lib/locales.ts`) and is RTL.

- `src/proxy.ts` — resolves the visitor's locale (cookie → `Accept-Language` → default) and redirects bare/foreign-locale paths to the correct `/{locale}/...` path. It explicitly skips `/_next`, `/internal`, `/robots.txt`, `/sitemap.xml`, and any path with a file extension.
- `src/app/[locale]/layout.tsx` — sets `<html lang dir>` server-side from the URL segment (via `resolveLocale`) and wraps children in `LanguageProvider`. `generateStaticParams()` prerenders both locales.
- `src/lib/language-context.tsx` (`LanguageProvider`/`useLanguage()`) — client-side language context. Locale is authoritative from the URL, not client state; this just exposes `{ lang, dir, t, arrow, backArrow, toggleLang }` to components. `toggleLang()` rewrites the current path's locale segment and sets the `mintapp_locale` cookie.
- `src/lib/i18n/types.ts` defines the full `HomeContent` shape; `src/lib/i18n/ar.ts` and `en.ts` are parallel translation dictionaries implementing it. Adding UI text means adding the key to `types.ts` and both dictionaries.
- `src/app/internal/` (concept pack) is a hidden, non-locale-prefixed route with its own layout — deliberately excluded from the locale proxy/redirect logic.

**Case studies**: each project under `src/app/[locale]/work/<name>/page.tsx` renders a matching `src/components/case-study/<Name>CaseStudy.tsx`, driven by a `csX` entry in the `HomeContent` i18n type (`csArrentio`, `csJameel`, etc.).

**Case study screenshots**: real product screenshots (not CSS mockups) live in `public/work/<project>/`, always shown whole inside the shared mockups in `src/components/work/Mockups.tsx`: `PhoneMockup` (frame sized in `cqw`, screen takes the image's exact aspect) and `BrowserMockup` (pages much taller than the window scroll on hover/focus, or by swiping on touch / reduced motion — never crop with `object-cover`). Rentop/Jameel keep a thin local `PhoneFrame` wrapper around `PhoneMockup`. Jameel is the one case study with locale-aware screenshots: Arabic images live in `public/work/jameel/ar/`, picked via `lang === "ar" ? "/work/jameel/ar" : "/work/jameel"`; Rentop and Arrentio are English-only regardless of site language, so don't assume that pattern applies everywhere. The homepage `WorkSection.tsx` work-card preview reuses the same `public/work/jameel/*.png` files directly via `next/image`, without `PhoneFrame` or locale-awareness.

Every other project (Kwayes, Taskaty, whHR, Budgetly, PMPS, OTJ, CircuitsCraft — a VR/AR game, shown in a headset frame) lists its screens in `src/content/work-screens.ts` (`WORK_SCREENS`), rendered by `src/components/work/ScreenFrames.tsx` (`CardCover`, `HeroScreen`, `ProductScreens`; each asset's `frame: "phone" | "browser" | "headset"` picks the mockup). whHR/Budgetly/PMPS/CircuitsCraft/OTJ share one component, `ProjectCaseStudy.tsx`, configured from their `page.tsx` (slug, `csKey`, theme classes) — no per-project component. Screens come from the clients' Figma files exported at 2x as `.webp` (website pages at full length, 1200px wide); OTJ's are instead 2x Playwright captures of the live public site (theotj.com, logged out, 430×932 mobile viewport). Adding a public route also means updating `PUBLIC_ROUTE_PATHS` in `src/lib/seo.ts`, the URL counts in `src/app/sitemap.test.ts` and `tests/e2e/sitemap-robots.spec.ts`, and `CASE_STUDY_KEYS` in `src/lib/i18n/work-copy.test.ts`. Arabic case-study copy must avoid the words the sample-wording test bans (e.g. افتراضي, except in "الواقع الافتراضي" = virtual reality).

**Motion/UX primitives** live in `src/components/motion/` (`Magnetic`, `SplitReveal`, `TiltCard`) and top-level (`Reveal`, `SmoothScroll` using Lenis, `CustomCursor`) — reuse these instead of hand-rolling new scroll/hover effects.

## Supabase

`supabase/migrations/` holds plain numbered SQL files (no `supabase/config.toml`, CLI not linked to any project — see `supabase/README.md`). Migrations are written idempotent (`if not exists` / `or replace` guards) so they're safe to re-run. See `docs/supabase-database-permissions.md` for the reasoning behind the schema/grants and a checklist for verifying against the live project.
