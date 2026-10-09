"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The lead's sections. Each is its own page, so this is navigation (with the
// current one marked), not an ARIA tab widget.
export default function LeadTabs({ base, label, items }: { base: string; label: string; items: { tab: string; label: string }[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="m-0 flex min-w-max list-none gap-1 p-0">
        {items.map((item) => {
          const href = item.tab === "overview" ? base : `${base}/${item.tab}`;
          const current = item.tab === "overview" ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={item.tab}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                data-tab={item.tab}
                className={`-mb-px inline-block border-b-2 px-3 py-2.5 text-[14px] font-semibold whitespace-nowrap ${current ? "border-mint-deep text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
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
