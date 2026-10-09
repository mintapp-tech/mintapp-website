"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_LOCALE_COOKIE, isAdminLocale } from "@/lib/admin/messages";
import { isAdminPage } from "@/lib/admin/surface";

// Switches the interface language and returns to the same admin page. Only
// admin paths are accepted as the return address.
export async function setAdminLocaleAction(form: FormData) {
  const locale = form.get("locale");
  const back = String(form.get("back") ?? "/dashboard");
  if (isAdminLocale(locale)) {
    (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect(isAdminPage(back.split("?")[0]) ? back : "/dashboard");
}
