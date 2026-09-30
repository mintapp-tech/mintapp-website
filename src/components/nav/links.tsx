"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { localizedPath, rememberLocale, useLanguage } from "@/lib/language-context";
import { scrollToSection, scrollToTop } from "@/lib/scroll";

interface LinkProps {
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}

// Modified or non-primary clicks (new tab, new window, download) must stay native.
export function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

// A homepage section (#work, ...). On the homepage itself a plain click smooth-scrolls
// in place; everywhere else it is an ordinary link to /{lang}#section.
export function SectionLink({ section, className, children, onNavigate }: LinkProps & { section: string }) {
  const { lang } = useLanguage();
  const pathname = usePathname();
  return (
    <Link
      href={`/${lang}#${section}`}
      className={className}
      onClick={(e) => {
        onNavigate?.();
        if (pathname === `/${lang}` && isPlainLeftClick(e)) {
          e.preventDefault();
          scrollToSection(section);
        }
      }}
    >
      {children}
    </Link>
  );
}

// A route link that announces itself as the current page when it is.
export function NavLink({ href, className, children, onNavigate }: LinkProps & { href: string }) {
  const pathname = usePathname();
  return (
    <Link href={href} aria-current={pathname === href ? "page" : undefined} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

// The locale homepage. Already there, a plain click scrolls back to the top.
export function HomeLink({ className, children, onNavigate, ariaLabel }: LinkProps & { ariaLabel?: string }) {
  const { lang } = useLanguage();
  const pathname = usePathname();
  return (
    <Link
      href={`/${lang}`}
      aria-label={ariaLabel}
      aria-current={pathname === `/${lang}` ? "page" : undefined}
      className={className}
      onClick={(e) => {
        onNavigate?.();
        if (pathname === `/${lang}` && isPlainLeftClick(e)) {
          e.preventDefault();
          scrollToTop();
        }
      }}
    >
      {children}
    </Link>
  );
}

// The current page in the other locale. Remembers the choice for the locale proxy and
// keeps the current #section on a plain click (an href can't know the hash at render).
// Never prefetched: proxy.ts stores the locale of every request it sees, so a background
// prefetch of the other locale would silently flip the visitor's saved preference.
// The visible text stays short (AR / EN, or the language name); the accessible name states the purpose.
export function LanguageLink({ className, children, onNavigate }: LinkProps) {
  const { lang, t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const next = lang === "ar" ? "en" : "ar";
  const href = localizedPath(pathname, next);
  return (
    <Link
      href={href}
      hrefLang={next}
      prefetch={false}
      aria-label={t.nav.switchLang}
      className={className}
      onClick={(e) => {
        rememberLocale(next);
        onNavigate?.();
        const hash = window.location.hash;
        if (hash && isPlainLeftClick(e)) {
          e.preventDefault();
          router.push(`${href}${hash}`);
        }
      }}
    >
      {children}
    </Link>
  );
}
