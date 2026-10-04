import type { SupportedLocale } from "@/lib/locales";

// Arabic descriptions for the published work screenshots, keyed by their
// English alt text, so images are described in the page's language.
export const WORK_ALT_AR: Record<string, string> = {
  "Arrentio marketplace homepage": "الصفحة الرئيسية لسوق Arrentio",
  "Arrentio logo": "شعار Arrentio",
  "Arrentio car detail and booking page": "صفحة تفاصيل السيارة والحجز في Arrentio",
  "Arrentio explore page with filters and live inventory": "صفحة الاستكشاف في Arrentio مع الفلاتر والمخزون المتاح مباشرة",
  "Arrentio provider onboarding page": "صفحة تسجيل المزوّدين في Arrentio",
  "Rentop home screen": "الشاشة الرئيسية لتطبيق Rentop",
  "Rentop home screen with brand and category browsing": "الشاشة الرئيسية لتطبيق Rentop مع التصفح حسب الماركة والفئة",
  "Rentop car detail page with specs, host and booking": "صفحة تفاصيل السيارة في Rentop مع المواصفات والمالك والحجز",
  "Rentop explore feed with listings": "صفحة الاستكشاف في Rentop مع قائمة الإعلانات",
  "Rentop car detail and host page": "صفحة تفاصيل السيارة والمالك في Rentop",
  "Rentop calendar booking and price breakdown": "الحجز عبر التقويم في Rentop مع تفاصيل السعر",
  "Jameel home screen": "الشاشة الرئيسية لتطبيق Jameel",
  "Jameel client app home screen with washing services": "الشاشة الرئيسية لتطبيق عملاء Jameel مع خدمات الغسيل",
  "Jameel service details and booking screen": "شاشة تفاصيل الخدمة والحجز في Jameel",
  "Jameel home screen with service categories": "الشاشة الرئيسية لتطبيق Jameel مع فئات الخدمات",
  "Jameel add location screen with map picker": "شاشة إضافة الموقع في Jameel مع اختيار المكان على الخريطة",
  "Jameel available booking times screen": "شاشة مواعيد الحجز المتاحة في Jameel",
  "Jameel saved payment methods screen": "شاشة طرق الدفع المحفوظة في Jameel",
};

export function localAlt(en: string, lang: SupportedLocale): string {
  return lang === "ar" ? (WORK_ALT_AR[en] ?? en) : en;
}
