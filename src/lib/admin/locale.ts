import "server-only";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, isAdminLocale, messagesFor, type AdminLocale } from "./messages";

// The admin interface language, chosen by each team member (English by default).
export async function adminLocale(): Promise<AdminLocale> {
  const value = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return isAdminLocale(value) ? value : "en";
}

export async function adminText() {
  const locale = await adminLocale();
  return { locale, t: messagesFor(locale) };
}
