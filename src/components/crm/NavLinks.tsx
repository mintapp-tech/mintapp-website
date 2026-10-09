"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The workspace navigation. The current section is marked for assistive
// technology and underlined for everyone else.
export default function NavLinks({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label} className="order-3 w-full sm:order-none sm:w-auto">
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
        {items.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
      </ul>
    </nav>
  );
}
