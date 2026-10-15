// Real product screens, exported from each project's Figma file, for the
// projects that don't hand-place their screenshots (Arrentio, Rentop and
// Jameel do that inside their case-study components).
//
// To publish screens for a project: put the files under public/work/<slug>/,
// list them below with English and Arabic alt text and their pixel size, and
// add a short intro that describes what the screens show. The homepage card
// then uses `cover` and the case study's "Product screens" section uses
// `screens`, both in device frames. Until then the drawn compositions stay.
// Only add screens the client has approved for publication, and describe
// them accurately.

export type ScreenProject =
  | "taskaty"
  | "kwayes"
  | "whhr"
  | "budgetly"
  | "pmps"
  | "circuitscraft"
  | "otj";

export interface ScreenAsset {
  src: string;
  width: number;
  height: number;
  alt: { en: string; ar: string };
  // Phone screens get a phone mockup; websites a browser window that
  // scrolls through pages taller than it; VR/AR views a headset viewport.
  frame: "phone" | "browser" | "headset";
  label?: string; // shown in the browser's address bar
}

export interface WorkScreens {
  // Replaces the "Compositions from ..." line once real screens are shown.
  intro?: { en: string; ar: string };
  cover?: ScreenAsset;
  screens: ScreenAsset[];
}

const phone = (src: string, en: string, ar: string, width = 860, height = 1864): ScreenAsset => ({ src, width, height, alt: { en, ar }, frame: "phone" });
const headset = (src: string, en: string, ar: string, width = 1600, height = 900): ScreenAsset => ({ src, width, height, alt: { en, ar }, frame: "headset" });
const web = (src: string, en: string, ar: string, label: string, width = 1600, height = 900): ScreenAsset => ({ src, width, height, alt: { en, ar }, frame: "browser", label });

const KWAYES = [
  phone("/work/kwayes/home.webp", "Kwayes home feed with categories and listings", "الصفحة الرئيسية في Kwayes مع الفئات والإعلانات", 750, 1624),
  phone("/work/kwayes/reel.webp", "Kwayes product video reel", "عرض فيديو لمنتج في Kwayes", 751, 1625),
  phone("/work/kwayes/product.webp", "Kwayes product details from the seller's store", "تفاصيل منتج من متجر البائع في Kwayes", 751, 1625),
  phone("/work/kwayes/messages.webp", "Kwayes messages between buyers and sellers", "الرسائل بين المشترين والبائعين في Kwayes", 750, 1624),
];

const TASKATY = [
  phone("/work/taskaty/home.webp", "Taskaty day view with activity timer and today's tasks", "عرض اليوم في Taskaty مع مؤقت النشاط ومهام اليوم"),
  phone("/work/taskaty/rearrange.webp", "Taskaty tasks pulled from Google Calendar and Notion", "مهام Taskaty المستوردة من Google Calendar و Notion"),
  phone("/work/taskaty/stats.webp", "Taskaty stats with time spent per activity", "إحصاءات Taskaty للوقت المقضي في كل نشاط"),
  phone("/work/taskaty/settings.webp", "Taskaty settings with targeted times and connections", "إعدادات Taskaty مع الأوقات المستهدفة والربط بالخدمات"),
];

const WHHR = [
  phone("/work/whhr/home.webp", "whHR home with check-in, attendance, overtime and gatepasses", "الشاشة الرئيسية في whHR مع تسجيل الحضور والعمل الإضافي وتصاريح الخروج"),
  phone("/work/whhr/schedule.webp", "whHR schedule with a day-by-day attendance view", "جدول whHR مع عرض الحضور يومًا بيوم"),
  phone("/work/whhr/analytics.webp", "whHR analytics with on-time rate and days attended", "تحليلات whHR مع نسبة الالتزام بالمواعيد وأيام الحضور"),
  phone("/work/whhr/attendance.webp", "whHR attendance details with check-in location map", "تفاصيل الحضور في whHR مع خريطة موقع تسجيل الدخول"),
];

const BUDGETLY = [
  phone("/work/budgetly/home.webp", "Budgetly home with total spending and latest expenses", "الشاشة الرئيسية في Budgetly مع إجمالي الإنفاق وآخر المصروفات", 786, 1704),
  phone("/work/budgetly/scan.webp", "Budgetly receipt scanner for adding an expense", "ماسح الإيصالات في Budgetly لإضافة مصروف", 786, 1704),
  phone("/work/budgetly/accounts.webp", "Budgetly accounts with a linked card and recent expenses", "حسابات Budgetly مع بطاقة مرتبطة وآخر المصروفات", 786, 1704),
  phone("/work/budgetly/budget.webp", "Budgetly monthly budget against expenses", "الميزانية الشهرية مقابل المصروفات في Budgetly", 786, 1704),
];

const PMPS = [
  web("/work/pmps/home.webp", "PMPS homepage", "الصفحة الرئيسية لموقع PMPS", "pmpsconsulting.com", 1200, 5918),
  web("/work/pmps/services.webp", "PMPS services page", "صفحة الخدمات في موقع PMPS", "pmpsconsulting.com", 1200, 3180),
  web("/work/pmps/project.webp", "PMPS project details page", "صفحة تفاصيل مشروع في موقع PMPS", "pmpsconsulting.com", 1200, 4148),
  web("/work/pmps/about.webp", "PMPS about page", "صفحة من نحن في موقع PMPS", "pmpsconsulting.com", 1200, 5608),
];

const CIRCUITSCRAFT = [
  headset("/work/circuitscraft/add-component.webp", "CircuitsCraft component library in VR", "مكتبة المكوّنات في CircuitsCraft بالواقع الافتراضي"),
  headset("/work/circuitscraft/breadboard.webp", "CircuitsCraft LED placed on a breadboard", "مصباح LED موضوع على لوحة التجارب في CircuitsCraft"),
  headset("/work/circuitscraft/code-editor.webp", "CircuitsCraft microcontroller code editor", "محرر كود المتحكم الدقيق في CircuitsCraft"),
  headset("/work/circuitscraft/trade.webp", "CircuitsCraft trade marketplace for circuits", "سوق تداول الدوائر في CircuitsCraft"),
];

const OTJ = [
  phone("/work/otj/explore.webp", "OTJ explore page with creatives grouped by field", "صفحة الاستكشاف في OTJ مع المبدعين مصنّفين حسب المجال"),
  phone("/work/otj/profile.webp", "A creative's public profile on OTJ with selected works", "الملف العام لمبدع على OTJ مع أعمال مختارة"),
  phone("/work/otj/packages.webp", "Packages a creative offers on their OTJ profile", "الباقات التي يقدّمها المبدع في ملفه على OTJ"),
  phone("/work/otj/brief.webp", "OTJ booking brief with project dates, location and budget", "نموذج طلب الحجز في OTJ مع تواريخ المشروع والموقع والميزانية"),
];

export const WORK_SCREENS: Record<ScreenProject, WorkScreens> = {
  taskaty: {
    intro: {
      en: "The day view, imported tasks, activity stats and settings, from the Taskaty design.",
      ar: "عرض اليوم، والمهام المستوردة، وإحصاءات النشاط، والإعدادات، من تصميم Taskaty.",
    },
    cover: TASKATY[0],
    screens: TASKATY,
  },
  kwayes: {
    intro: {
      en: "The home feed, a product reel, product details and messages, from the Kwayes design.",
      ar: "الصفحة الرئيسية، وعرض فيديو لمنتج، وتفاصيل المنتج، والرسائل، من تصميم Kwayes.",
    },
    cover: KWAYES[0],
    screens: KWAYES,
  },
  whhr: {
    intro: {
      en: "Home, schedule, analytics and attendance details, from the whHR employee app.",
      ar: "الرئيسية، والجدول، والتحليلات، وتفاصيل الحضور، من تطبيق موظفي whHR.",
    },
    cover: WHHR[0],
    screens: WHHR,
  },
  budgetly: {
    intro: {
      en: "Home, receipt scanning, accounts and the monthly budget, from the Budgetly app.",
      ar: "الرئيسية، ومسح الإيصالات، والحسابات، والميزانية الشهرية، من تطبيق Budgetly.",
    },
    cover: BUDGETLY[0],
    screens: BUDGETLY,
  },
  pmps: {
    intro: {
      en: "The homepage, services, a project page and the about page, from the PMPS website.",
      ar: "الصفحة الرئيسية، والخدمات، وصفحة مشروع، وصفحة من نحن، من موقع PMPS.",
    },
    cover: PMPS[0],
    screens: PMPS,
  },
  circuitscraft: {
    intro: {
      en: "The component library, the breadboard, the code editor and the trade marketplace, from CircuitsCraft.",
      ar: "مكتبة المكوّنات، ولوحة التجارب، ومحرر الكود، وسوق التداول، من CircuitsCraft.",
    },
    cover: CIRCUITSCRAFT[1],
    screens: CIRCUITSCRAFT,
  },
  otj: {
    intro: {
      en: "Explore, a creative's profile, their packages and the booking brief, from the live OTJ platform.",
      ar: "الاستكشاف، وملف المبدع، وباقاته، ونموذج طلب الحجز، من منصة OTJ الفعلية.",
    },
    cover: OTJ[0],
    screens: OTJ,
  },
};

export const hasRealScreens = (slug: ScreenProject) => WORK_SCREENS[slug].screens.length > 0;
