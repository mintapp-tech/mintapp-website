"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// The restrained secondary menu: settings and technical areas, out of the
// primary navigation. A disclosure that closes on navigation and on Escape.
export default function MoreMenu({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const pathname = usePathname() ?? "";
  const ref = useRef<HTMLDetailsElement>(null);
  const current = items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  return (
    <details
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current?.open) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        className={`inline-block cursor-pointer list-none border-b-2 pb-0.5 text-[14px] font-semibold [&::-webkit-details-marker]:hidden ${current ? "border-mint text-white" : "border-transparent text-white/75 hover:text-white"}`}
        data-more-menu
      >
        {label} <span aria-hidden>▾</span>
      </summary>
      <ul className="absolute start-0 top-full z-20 m-0 mt-2 min-w-44 list-none rounded-xl border border-line bg-surface p-1.5 shadow-lg">
        {items.map((item) => {
          const here = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={here ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-[14px] font-semibold text-ink hover:bg-surface-2 ${here ? "bg-surface-2" : ""}`}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
