// The people behind Mintapp, shown in "Built by" on the homepage and About page.
// Names and photos are published with each person's own approval.

import type { SupportedLocale as Locale } from "@/lib/locales";

export interface TeamMember {
  id: string;
  name: string;
  // The name as written in another language, where the person gave one.
  displayName?: Partial<Record<Locale, string>>;
  role: Record<Locale, string>;
  bio: Record<Locale, string>;
  // Square photo under /public.
  photo: string;
  // Public profile, linked only when the person supplied it.
  linkedin?: string;
}

export const TEAM: readonly TeamMember[] = [
  {
    id: "omar-abdelaziz",
    name: "Omar Abdelaziz",
    displayName: { ar: "عمر عبد العزيز" },
    role: { en: "Founder", ar: "المؤسس" },
    bio: {
      en: "Omar is a software engineer and founder of Mintapp, with experience across digital product development, business systems and technology operations. He has trained in international technology and fintech environments and focuses on turning complex ideas into clear, practical digital solutions.",
      ar: "عمر مهندس برمجيات ومؤسس Mintapp، ويتمتع بخبرة في تطوير المنتجات الرقمية، وأنظمة الأعمال، والعمليات التقنية. تلقّى تدريبًا في بيئات دولية بمجالي التكنولوجيا والتقنية المالية، ويركّز على تحويل الأفكار المعقدة إلى حلول رقمية واضحة وعملية.",
    },
    photo: "/team/omar-abdelaziz-founder.jpg",
    linkedin: "https://www.linkedin.com/in/omarabdelaziz26",
  },
  {
    id: "adam-eba",
    name: "Abdelrahman (Adam) Eba",
    role: { en: "Co-Founder & Senior Software Engineer", ar: "الشريك المؤسس ومهندس برمجيات أول" },
    bio: {
      en: "Specialized in mobile app development. Has spoken at Google developer community events around the world and worked with international companies.",
      ar: "متخصص في تطوير تطبيقات الموبايل. تحدّث في فعاليات مجتمعات Google للمطوّرين حول العالم، وعمل مع شركات دولية.",
    },
    photo: "/team/adam-eba.jpg",
  },
];
