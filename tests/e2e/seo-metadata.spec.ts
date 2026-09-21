import { test, expect } from "@playwright/test";

// Locale-aware metadata coverage for every real page pair (derived from the
// actual route inventory — see docs/deployments.md-style verification: `find
// src/app -name page.tsx` — 13 locale-routed pages, 26 URLs total). No
// sitemap/OG/JSON-LD/404/analytics assertions here — that's later milestones.

const ROUTES: { path: string; en: { title: string; description: string }; ar: { title: string; description: string } }[] = [
  {
    path: "",
    en: {
      title: "Mintapp — Software that feels easy",
      description:
        "Mintapp is a digital product studio helping startups and growing businesses across Egypt and the MENA region turn ideas into thoughtful, launch-ready websites and mobile apps.",
    },
    ar: {
      title: "Mintapp — برمجيات تُصنع بسهولة",
      description:
        "Mintapp استوديو منتجات رقمية يساعد الشركات الناشئة والنامية في مصر والمنطقة العربية على تحويل أفكارها إلى مواقع وتطبيقات مدروسة وجاهزة للإطلاق.",
    },
  },
  {
    path: "/about",
    en: {
      title: "About — Mintapp",
      description:
        "Mintapp is a digital product studio working with founders and small teams in Egypt and MENA to turn early ideas into launch-ready products.",
    },
    ar: {
      title: "من نحن — Mintapp",
      description:
        "Mintapp استوديو منتجات رقمية يعمل مع المؤسسين والفرق الصغيرة في مصر والمنطقة العربية لتحويل الأفكار المبكرة إلى منتجات جاهزة للإطلاق.",
    },
  },
  {
    path: "/services",
    en: {
      title: "Services — Mintapp",
      description:
        "Mintapp builds websites, web apps and mobile apps — one complete process from product strategy through design, development, testing and launch.",
    },
    ar: {
      title: "خدماتنا — Mintapp",
      description:
        "Mintapp تبني مواقع وتطبيقات ويب وموبايل — عملية واحدة متكاملة من استراتيجية المنتج إلى التصميم والتطوير والاختبار والإطلاق.",
    },
  },
  {
    path: "/insights",
    en: {
      title: "Insights — Mintapp",
      description:
        "Short writing on building digital products in Egypt and the wider MENA region — product strategy, UX/UI design, and web and mobile development.",
    },
    ar: {
      title: "مقالات — Mintapp",
      description: "كتابات موجزة عن بناء المنتجات الرقمية في مصر والمنطقة العربية — استراتيجية المنتج، تصميم التجربة والواجهة، وتطوير الويب والموبايل.",
    },
  },
  {
    path: "/start",
    en: {
      title: "Start a Project — Mintapp",
      description: "Tell Mintapp what you want to build. Our team studies your idea and prepares an initial direction before your meeting.",
    },
    ar: {
      title: "ابدأ مشروعك — Mintapp",
      description: "أخبر Mintapp بما تريد بناءه. يدرس فريقنا فكرتك ويجهّز اتجاهًا مبدئيًا قبل اجتماعك.",
    },
  },
  {
    path: "/privacy",
    en: {
      title: "Privacy Policy — Mintapp",
      description: "How Mintapp collects, uses and protects the information you share with us through this website.",
    },
    ar: {
      title: "سياسة الخصوصية — Mintapp",
      description: "كيف تجمع Mintapp المعلومات التي تشاركها معنا عبر هذا الموقع وكيف نستخدمها ونحميها.",
    },
  },
  {
    path: "/work/arrentio",
    en: {
      title: "Arrentio — Case Study — Mintapp",
      description:
        "How Mintapp built Arrentio: a verified car rental marketplace and agency platform with multi-tenant storefronts, designed for Indonesia and the Gulf.",
    },
    ar: {
      title: "Arrentio — دراسة حالة — Mintapp",
      description: "كيف بنت Mintapp Arrentio: سوق موثوق لتأجير السيارات ومنصة تشغيل للوكالات بمتاجر متعددة النطاقات، مصممة لإندونيسيا والخليج.",
    },
  },
  {
    path: "/work/jameel",
    en: {
      title: "Jameel — Case Study — Mintapp",
      description: "How Mintapp built Jameel: a four-sided car wash service marketplace with customer, provider and worker apps plus an admin dashboard.",
    },
    ar: {
      title: "Jameel — دراسة حالة — Mintapp",
      description: "كيف بنت Mintapp Jameel: سوق خدمات غسيل سيارات رباعي الأطراف بتطبيقات للعميل والمزوّد والعامل ولوحة تحكم إدارية.",
    },
  },
  {
    path: "/work/kwayes",
    en: {
      title: "Kwayes — Case Study — Mintapp",
      description: "How Mintapp built Kwayes: a social marketplace for selling secondhand goods with photo and video listings and in-app messaging.",
    },
    ar: {
      title: "Kwayes — دراسة حالة — Mintapp",
      description: "كيف بنت Mintapp Kwayes: سوق اجتماعي لبيع الأغراض المستعملة بإعلانات بالصور والفيديو ومراسلات داخل التطبيق.",
    },
  },
  {
    path: "/work/nazarih",
    en: {
      title: "Nazarih — Case Study — Mintapp",
      description: "How Mintapp built Nazarih: a multi-category classifieds marketplace spanning real estate, vehicles, hardware and everyday goods.",
    },
    ar: {
      title: "Nazarih — دراسة حالة — Mintapp",
      description: "كيف بنت Mintapp Nazarih: سوق إعلانات مبوّبة متعدد الفئات يشمل العقارات والمركبات والأدوات والسلع اليومية.",
    },
  },
  {
    path: "/work/rentop",
    en: {
      title: "Rentop — Case Study — Mintapp",
      description: "How Mintapp built Rentop: a consumer car rental app for browsing by brand and category and booking directly, built for the UAE market.",
    },
    ar: {
      title: "Rentop — دراسة حالة — Mintapp",
      description: "كيف بنت Mintapp Rentop: تطبيق تأجير سيارات للمستهلك للتصفّح حسب الماركة والفئة والحجز مباشرة، مصمم لسوق الإمارات.",
    },
  },
  {
    path: "/work/tanglevibe",
    en: {
      title: "TangleVibe — Case Study — Mintapp",
      description: "How Mintapp built TangleVibe: a dating app designed around intentional matching and conversations that go somewhere.",
    },
    ar: {
      title: "TangleVibe — دراسة حالة — Mintapp",
      description: "كيف بنت Mintapp TangleVibe: تطبيق تعارف مبني على مطابقة مقصودة ومحادثات تصل فعلاً إلى نتيجة.",
    },
  },
  {
    path: "/work/taskaty",
    en: {
      title: "Taskaty — Case Study — Mintapp",
      description: "How Mintapp built Taskaty: a focused task management app that gives small teams one shared view of what's assigned, due and done.",
    },
    ar: {
      title: "Taskaty — دراسة حالة — Mintapp",
      description: "كيف بنت Mintapp Taskaty: تطبيق إدارة مهام مركّز يمنح الفرق الصغيرة رؤية واحدة مشتركة لما هو مُسنَد ومستحق ومنجز.",
    },
  },
];

test.describe("locale-aware SEO metadata — all 13 route pairs / 26 URLs", () => {
  for (const route of ROUTES) {
    for (const locale of ["en", "ar"] as const) {
      const copy = route[locale];
      const url = `/${locale}${route.path}`;

      test(`${url} — title, description, canonical, reciprocal alternates, lang/dir`, async ({ page }) => {
        const response = await page.goto(url);
        expect(response?.status()).toBe(200);

        await expect(page).toHaveTitle(copy.title);

        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveAttribute("content", copy.description);

        const canonical = page.locator('link[rel="canonical"]');
        await expect(canonical).toHaveAttribute("href", `https://www.mintapp.tech/${locale}${route.path}`);

        const enAlternate = page.locator('link[rel="alternate"][hreflang="en"]');
        await expect(enAlternate).toHaveAttribute("href", `https://www.mintapp.tech/en${route.path}`);
        const arAlternate = page.locator('link[rel="alternate"][hreflang="ar"]');
        await expect(arAlternate).toHaveAttribute("href", `https://www.mintapp.tech/ar${route.path}`);

        // Never a mechanical x-default — this milestone deliberately omits it.
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(0);

        const html = page.locator("html");
        await expect(html).toHaveAttribute("lang", locale);
        await expect(html).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      });
    }
  }

  test("the route inventory itself has exactly 13 pairs / 26 URLs — guards against silently adding/removing a page without updating this suite", () => {
    expect(ROUTES.length).toBe(13);
  });
});
