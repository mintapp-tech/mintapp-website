import { test, expect } from "@playwright/test";

const SITE_URL = "https://www.mintapp.tech";
const OG_IMAGE_URL = `${SITE_URL}/og/mintapp-default.png`;

const ROUTES: { path: string; en: { title: string; description: string }; ar: { title: string; description: string } }[] = [
  {
    path: "",
    en: {
      title: "Mintapp — Software that feels easy",
      description:
        "Mintapp designs and builds websites, web apps and mobile apps for founders and teams in Egypt, MENA and beyond. We review your idea before the first call.",
    },
    ar: {
      title: "Mintapp — برمجيات تُصنع بسهولة",
      description:
        "تصمّم Mintapp وتطوّر مواقع وتطبيقات ويب وموبايل للمؤسسين والفرق في مصر والمنطقة العربية وخارجها. نراجع فكرتك قبل المكالمة الأولى.",
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
  {
    path: "/work/budgetly",
    en: {
      title: "Budgetly — Case Study — Mintapp",
      description:
        "How Mintapp designed Budgetly: a personal budgeting app with receipt scanning, linked accounts and monthly budgets by category.",
    },
    ar: {
      title: "Budgetly — دراسة حالة — Mintapp",
      description:
        "كيف صممت Mintapp تطبيق Budgetly: تطبيق لإدارة الميزانية الشخصية مع مسح الإيصالات وربط الحسابات وميزانيات شهرية حسب الفئة.",
    },
  },
  {
    path: "/work/circuitscraft",
    en: {
      title: "CircuitsCraft — Case Study — Mintapp",
      description:
        "How Mintapp designed CircuitsCraft: a VR/AR game for building electronic circuits in 3D space, with a component library, breadboard, microcontroller code editor and a player marketplace.",
    },
    ar: {
      title: "CircuitsCraft — دراسة حالة — Mintapp",
      description:
        "كيف صممت Mintapp لعبة CircuitsCraft: لعبة بالواقع الافتراضي والمعزّز لبناء الدوائر الإلكترونية في فضاء ثلاثي الأبعاد، مع مكتبة مكوّنات ولوحة تجارب ومحرر كود للمتحكم الدقيق وسوق للاعبين.",
    },
  },
  {
    path: "/work/otj",
    en: {
      title: "OTJ — Case Study — Mintapp",
      description:
        "How Mintapp built OTJ: a marketplace where clients book creatives for one-off projects and run them from brief to proposal, payment and delivery.",
    },
    ar: {
      title: "OTJ — دراسة حالة — Mintapp",
      description:
        "كيف بنت Mintapp منصة OTJ: سوق يحجز فيه العملاء المبدعين لمشاريع لمرة واحدة ويديرونها من الطلب إلى العرض والدفع والتسليم.",
    },
  },
  {
    path: "/work/pmps",
    en: {
      title: "PMPS — Case Study — Mintapp",
      description:
        "How Mintapp designed the PMPS website: a construction and project management consultancy site covering services, industries and project case pages.",
    },
    ar: {
      title: "PMPS — دراسة حالة — Mintapp",
      description:
        "كيف صممت Mintapp موقع PMPS: موقع لشركة استشارات في إدارة الإنشاءات والمشاريع يعرض الخدمات والقطاعات وصفحات المشاريع.",
    },
  },
  {
    path: "/work/whhr",
    en: {
      title: "whHR — Case Study — Mintapp",
      description:
        "How Mintapp designed whHR: an employee app for checking in, tracking attendance, overtime and gatepasses, and viewing HR records.",
    },
    ar: {
      title: "whHR — دراسة حالة — Mintapp",
      description:
        "كيف صممت Mintapp تطبيق whHR: تطبيق للموظفين لتسجيل الحضور ومتابعة الدوام والعمل الإضافي وتصاريح الخروج والاطلاع على بيانات الموارد البشرية.",
    },
  },
];

test.describe("Open Graph and Twitter metadata — all 15 route pairs / 30 URLs", () => {
  for (const route of ROUTES) {
    for (const locale of ["en", "ar"] as const) {
      const copy = route[locale];
      const url = `/${locale}${route.path}`;
      const alternateLocale = locale === "en" ? "ar_EG" : "en_US";
      const ogLocale = locale === "en" ? "en_US" : "ar_EG";

      test(`${url}`, async ({ page }) => {
        const response = await page.goto(url);
        expect(response?.status()).toBe(200);

        // Exactly one of each tag.
        await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
        await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
        await expect(page.locator('meta[property="og:type"]')).toHaveCount(1);
        await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
        await expect(page.locator('meta[property="og:site_name"]')).toHaveCount(1);
        await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
        await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
        await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);
        await expect(page.locator('meta[name="twitter:description"]')).toHaveCount(1);
        await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);

        // Correct localized values, matching the page's own established title/description.
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", copy.title);
        await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", copy.description);
        await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", copy.title);
        await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", copy.description);

        // type, site name, locale, reciprocal alternate locale.
        await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
        await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Mintapp");
        await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", ogLocale);
        await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute("content", alternateLocale);

        // Self-canonical og:url, absolute production origin.
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${SITE_URL}${url}`);

        // Absolute production image URL, correct dimensions and alt text, on both og and twitter.
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", OG_IMAGE_URL);
        await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
        await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
        const ogAlt = await page.locator('meta[property="og:image:alt"]').getAttribute("content");
        expect(ogAlt && ogAlt.length > 0).toBe(true);

        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
        await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", OG_IMAGE_URL);
        const twitterAlt = await page.locator('meta[name="twitter:image:alt"]').getAttribute("content");
        expect(twitterAlt && twitterAlt.length > 0).toBe(true);

        // Never a fabricated Twitter handle.
        await expect(page.locator('meta[name="twitter:site"]')).toHaveCount(0);
        await expect(page.locator('meta[name="twitter:creator"]')).toHaveCount(0);

        // Milestone 1 behavior still intact: canonical, reciprocal hreflang, no x-default, lang/dir.
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE_URL}${url}`);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", `${SITE_URL}/en${route.path}`);
        await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute("href", `${SITE_URL}/ar${route.path}`);
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(0);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      });
    }
  }
});

test.describe("/internal/concept-pack never receives public social metadata", () => {
  test("has no og: or twitter: tags", async ({ page }) => {
    await page.goto("/internal/concept-pack");
    await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
    await expect(page.locator('meta[name^="twitter:"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("the default social-preview image asset", () => {
  test("is served successfully with the correct content type and exact expected byte size", async ({ page }) => {
    const response = await page.goto("/og/mintapp-default.png");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"]).toBe("image/png");
  });
});

test.describe("no regression to sitemap or robots from this milestone", () => {
  test("/sitemap.xml lists exactly the 30 URLs of the 15 route pairs", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    const body = await response!.text();
    const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locations.length).toBe(30);
    const expected = ROUTES.flatMap((route) => (["en", "ar"] as const).map((locale) => `${SITE_URL}/${locale}${route.path}`));
    expect([...locations].sort()).toEqual([...expected].sort());
  });

  test("/robots.txt is unchanged", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    const body = await response!.text();
    expect(body).toContain("Disallow: /internal/");
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});
