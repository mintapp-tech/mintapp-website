// Public reviews of Adam Eba's work, copied from his Fiverr profile on
// 19 October 2026. These are not client-approved testimonials (see
// testimonials.ts): each one is shown as a public Fiverr review, word for word
// with its spelling, under the reviewer's Fiverr username, and the section
// links to the profile where every review can be read.
//
// Reviews under 4 stars are left out at the owner's request, so the profile's
// overall score and review count are always shown beside them.

import type { SupportedLocale as Locale } from "@/lib/locales";

export const FIVERR_PROFILE_URL = "https://www.fiverr.com/abdelrahmanayme";

// The profile's own totals, including the reviews not shown here.
export const FIVERR_SUMMARY = { rating: 4.4, count: 20 } as const;

// Our own names for regions whose Intl.DisplayNames label we don't use.
export const COUNTRY_NAMES: Partial<Record<string, Record<Locale, string>>> = {
  PS: { en: "Palestine", ar: "فلسطين" },
};

export interface FiverrReview {
  user: string;
  // ISO 3166-1 alpha-2, rendered in the page's language with Intl.DisplayNames
  // (or COUNTRY_NAMES below, where we name a place differently).
  country: string;
  rating: number;
  quote: string;
  quoteLanguage: Locale;
}

// The most detailed reviews first.
export const FIVERR_REVIEWS: readonly FiverrReview[] = [
  {
    user: "poutram",
    country: "US",
    rating: 5,
    quoteLanguage: "en",
    quote:
      "I appreciate that the app was delivered on time and the developer listened to all of my concerns and ideas and created a beautiful appropriate app. abdelrahmanayme is the best. He made sure that my ideas of color and graphics were appropriate for my app. He gave me suggestions that I approved because they were better than what I wanted. abdelrahmanayme always replied to me promptly. The quality is excellent. I would always recommend him.",
  },
  {
    user: "schahmatte",
    country: "DE",
    rating: 5,
    quoteLanguage: "en",
    quote:
      "Abdelrahm is a professional in the mobile app space and his expertise in this space is evident from the get go. Super easy to work with and delivered quality app. The result was above and beyond what I expected.",
  },
  { user: "arabianguests", country: "SA", rating: 5, quoteLanguage: "en", quote: "Very cool seller, very professional in programming, I made an application and a website and I am really happy to get to know this person" },
  { user: "arabic4u", country: "EG", rating: 5, quoteLanguage: "en", quote: "Abd Elrahman is born to be a programmer.\nIt was nice having him working in one app, and I already hired him again to do my second app." },
  { user: "arbeitauslagern", country: "DE", rating: 5, quoteLanguage: "en", quote: "Excellent work. Highly recommended. This guy is professional and experienced. I Will order again with my next app" },
  { user: "johnwebb553", country: "US", rating: 5, quoteLanguage: "en", quote: "Abe communicates very well and has exceptional talents for building aps. Highly recommended!" },
  { user: "yazenothman", country: "PS", rating: 5, quoteLanguage: "en", quote: "highly recommend and very patient he did for me more than what i expect wooow" },
  { user: "user78126607", country: "SA", rating: 4.3, quoteLanguage: "en", quote: "All is good\nCommunication is a strength\nTiming could be better" },
  { user: "arbeitauslagern", country: "DE", rating: 5, quoteLanguage: "en", quote: "excellent job again. big thanks for these app. saved my life" },
  { user: "arbeitauslagern", country: "DE", rating: 5, quoteLanguage: "en", quote: "excellent new app. happy about professional looking result." },
  { user: "jameelksa", country: "SA", rating: 5, quoteLanguage: "ar", quote: "شكرا على اهتمامك و حسن تعاملك صراحة هذا الرجل له عمل جبار." },
  { user: "heleneodonnelll", country: "AU", rating: 5, quoteLanguage: "en", quote: "Excellent patient seller! Will definitely use him again" },
  { user: "johnwebb553", country: "US", rating: 5, quoteLanguage: "en", quote: "Very professional and timely! Highly recommend!" },
  { user: "arabianguests", country: "SA", rating: 5, quoteLanguage: "en", quote: "Great seller very professional in his business" },
  { user: "jameelksa", country: "SA", rating: 5, quoteLanguage: "en", quote: "Excellent developer thank you very much!!!" },
  { user: "vijaygupta562", country: "IN", rating: 5, quoteLanguage: "en", quote: "very supportive all the best" },
  { user: "johnwebb553", country: "US", rating: 5, quoteLanguage: "en", quote: "Thank you for your hard work" },
  { user: "jameelksa", country: "SA", rating: 5, quoteLanguage: "ar", quote: "ممتاز جدا 😉" },
  { user: "eslamserry", country: "QA", rating: 5, quoteLanguage: "ar", quote: "ممتاز جدا" },
];
