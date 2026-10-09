"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The workspace navigation. The current section is marked for assistive
// technology and underlined for everyone else. `also` lists other paths that
// belong to a section (for example a prospect's page under Growth).
export default function NavLinks({ items, label, children }: { items: { href: string; label: string; also?: string[] }[]; label: string; children?: ReactNode }) {
  const pathname = usePathname() ?? "";
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label={label} className="order-3 w-full sm:order-none sm:w-auto">
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-1 p-0">
        {items.map((item) => {
          const current = under(item.href) || (item.also ?? []).some(under);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`inline-block border-b-2 pb-0.5 text-[14px] font-semibold ${current ? "border-mint text-white" : "border-transparent text-white/75 hover:text-white"}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        {children && <li>{children}</li>}
      </ul>
    </nav>
  );
}
