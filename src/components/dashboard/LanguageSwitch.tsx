"use client";

import { usePathname } from "next/navigation";
import { setAdminLocaleAction } from "@/app/(admin)/locale-action";

// Switches the admin interface between English and Arabic, staying on the same page.
export default function LanguageSwitch({ to, label, title, className }: { to: "en" | "ar"; label: string; title: string; className: string }) {
  const pathname = usePathname();
  return (
    <form action={setAdminLocaleAction}>
      <input type="hidden" name="locale" value={to} />
      <input type="hidden" name="back" value={pathname} />
      <button type="submit" lang={to} title={title} aria-label={title} className={className}>
        {label}
      </button>
    </form>
  );
}
