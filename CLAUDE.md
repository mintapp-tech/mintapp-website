# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Not stock Next.js

This repo pins `next@16.2.12`, a version with breaking changes vs. training-data Next.js — conventions and APIs may differ. Before touching routing, middleware, caching, or config, check `node_modules/next/dist/docs/` (mirrors nextjs.org docs for this exact version). One confirmed deviation: **middleware is `src/proxy.ts` exporting `proxy()`**, not `middleware.ts`/`export function middleware()`.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- No test suite configured.

## Architecture

**Bilingual site (ar/en), locale-prefixed routing.** Every public page lives under `src/app/[locale]/...` (e.g. `/ar/services`, `/en/work/kwayes`). Arabic is the default locale (`DEFAULT_LOCALE` in `src/lib/locales.ts`) and is RTL.

- `src/proxy.ts` — resolves the visitor's locale (cookie → `Accept-Language` → default) and redirects bare/foreign-locale paths to the correct `/{locale}/...` path. It explicitly skips `/_next`, `/internal`, `/robots.txt`, `/sitemap.xml`, and any path with a file extension.
- `src/app/[locale]/layout.tsx` — sets `<html lang dir>` server-side from the URL segment (via `resolveLocale`) and wraps children in `LanguageProvider`. `generateStaticParams()` prerenders both locales.
- `src/lib/language-context.tsx` (`LanguageProvider`/`useLanguage()`) — client-side language context. Locale is authoritative from the URL, not client state; this just exposes `{ lang, dir, t, arrow, backArrow, toggleLang }` to components. `toggleLang()` rewrites the current path's locale segment and sets the `mintapp_locale` cookie.
- `src/lib/i18n/types.ts` defines the full `HomeContent` shape; `src/lib/i18n/ar.ts` and `en.ts` are parallel translation dictionaries implementing it. Adding UI text means adding the key to `types.ts` and both dictionaries.
- `src/app/internal/` (concept pack) is a hidden, non-locale-prefixed route with its own layout — deliberately excluded from the locale proxy/redirect logic.

**Case studies**: each project under `src/app/[locale]/work/<name>/page.tsx` renders a matching `src/components/case-study/<Name>CaseStudy.tsx`, driven by a `csX` entry in the `HomeContent` i18n type (`csArrentio`, `csJameel`, etc.).

**Motion/UX primitives** live in `src/components/motion/` (`Magnetic`, `SplitReveal`, `TiltCard`) and top-level (`Reveal`, `SmoothScroll` using Lenis, `CustomCursor`) — reuse these instead of hand-rolling new scroll/hover effects.

## Supabase

`supabase/migrations/` holds plain numbered SQL files (no `supabase/config.toml`, CLI not linked to any project — see `supabase/README.md`). Migrations are written idempotent (`if not exists` / `or replace` guards) so they're safe to re-run. See `docs/supabase-database-permissions.md` for the reasoning behind the schema/grants and a checklist for verifying against the live project.
