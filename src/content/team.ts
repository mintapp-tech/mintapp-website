// The people behind Mintapp, shown in "Built by" on the homepage and About page.
// Names and photos are published with each person's own approval.

import type { SupportedLocale as Locale } from "@/lib/locales";

export interface TeamMember {
  id: string;
  name: string;
  role: Record<Locale, string>;
  bio: Record<Locale, string>;
  // Square photo under /public.
  photo: string;
}

export const TEAM: readonly TeamMember[] = [
  {
    id: "adam-eba",
    name: "Abdelrahman (Adam) Eba",
    role: { en: "Founder & Senior Software Engineer", ar: "المؤسس ومهندس برمجيات أول" },
    bio: {
      en: "Specialized in mobile app development. Has spoken at Google developer community events around the world and worked with international companies.",
      ar: "متخصص في تطوير تطبيقات الموبايل. تحدّث في فعاليات مجتمعات Google للمطوّرين حول العالم، وعمل مع شركات دولية.",
    },
    photo: "/team/adam-eba.jpg",
  },
  {
    id: "omar-abdelaziz",
    name: "Omar Abdelaziz",
    role: { en: "Co-founder & Software Engineer", ar: "شريك مؤسس ومهندس برمجيات" },
    bio: {
      en: "Studies software engineering at Universiti Teknologi Malaysia and builds web and mobile products with Mintapp.",
      ar: "يدرس هندسة البرمجيات في الجامعة التكنولوجية الماليزية، ويبني منتجات الويب والموبايل مع Mintapp.",
    },
    photo: "/team/omar-abdelaziz.jpg",
  },
];
