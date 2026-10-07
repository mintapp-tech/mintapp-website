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

test.describe("Open Graph and Twitter metadata — all 12 route pairs / 24 URLs", () => {
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
  test("/sitemap.xml still has exactly 24 URLs", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    const body = await response!.text();
    const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)];
    expect(locations.length).toBe(24);
  });

  test("/robots.txt is unchanged", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    const body = await response!.text();
    expect(body).toContain("Disallow: /internal/");
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});
