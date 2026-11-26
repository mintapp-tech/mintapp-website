import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TEAM } from "./team";
import { en } from "@/lib/i18n/en";
import { ar } from "@/lib/i18n/ar";

describe("team", () => {
  test("Omar first, then Adam, each with a photo on disk and copy in both languages", () => {
    expect(TEAM.map((m) => m.name)).toEqual(["Omar Abdelaziz", "Abdelrahman (Adam) Eba"]);
    for (const m of TEAM) {
      expect(existsSync(join(process.cwd(), "public", m.photo)), m.id).toBe(true);
      for (const lang of ["en", "ar"] as const) {
        expect(m.role[lang].trim(), `${m.id} role ${lang}`).not.toBe("");
        expect(m.bio[lang].trim(), `${m.id} bio ${lang}`).not.toBe("");
      }
    }
  });

  test("Omar's profile is exactly as approved", () => {
    expect(TEAM[0]).toEqual({
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
    });
  });

  test("Adam's profile is unchanged", () => {
    expect(TEAM[1]).toEqual({
      id: "adam-eba",
      name: "Abdelrahman (Adam) Eba",
      role: { en: "Founder & Senior Software Engineer", ar: "المؤسس ومهندس برمجيات أول" },
      bio: {
        en: "Specialized in mobile app development. Has spoken at Google developer community events around the world and worked with international companies.",
        ar: "متخصص في تطوير تطبيقات الموبايل. تحدّث في فعاليات مجتمعات Google للمطوّرين حول العالم، وعمل مع شركات دولية.",
      },
      photo: "/team/adam-eba.jpg",
    });
  });

  test("the section is introduced as the founding team, supported by a wider project team", () => {
    expect([en.team.title, en.team.sub]).toEqual(["Founding team", "Mintapp is led by its founding team and supported by designers, engineers and specialists selected around each project."]);
    expect([ar.team.title, ar.team.sub]).toEqual(["الفريق المؤسس", "تقود Mintapp مجموعتها المؤسسة، ويدعمها مصممون ومهندسون ومتخصصون يتم اختيارهم بما يناسب احتياجات كل مشروع."]);
    // The About page must not claim that the founders do everything themselves.
    expect(JSON.stringify(en.about.model)).not.toMatch(/small|are the ones who build it/i);
    expect(JSON.stringify(ar.about.model)).not.toMatch(/فريق صغير|هم من ينفّذونه/);
  });
});
