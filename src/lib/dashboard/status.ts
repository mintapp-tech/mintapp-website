// Plain-language status for the dashboard, in English and Arabic. Pure, so it
// is unit-tested. The goal is that no inquiry silently waits: whenever
// automation cannot produce a draft (off, paused, failed, out of budget), the
// inquiry is flagged as needing attention with the manual path offered.

export type Tone = "attention" | "info" | "ok";
export type Locale = "en" | "ar";

const ERRORS: Record<Locale, Record<string, string>> = {
  en: {
    timeout: "the provider took too long to answer",
    rate_limited: "the provider asked us to slow down",
    quota_exhausted: "the provider's free allowance is used up",
    budget_exhausted: "this month's token budget is used up",
    auth_failed: "the provider rejected the API key",
    model_unavailable: "the configured model is not available",
    provider_error: "the provider had an error",
    provider_unreachable: "the provider could not be reached",
    malformed_response: "the provider's reply was not usable",
    invalid_output: "the reply was not valid JSON",
    truncated: "the reply was cut off",
    lease_expired: "a worker stopped before finishing",
    inquiry_missing: "the inquiry could not be loaded",
    unknown: "an unknown problem",
    ungrounded: "the draft quoted facts that are not in the brief",
    unsupported: "the draft contained figures the client never stated",
    wrong_language: "the draft was in the wrong language",
    schema: "the draft did not have the required structure",
  },
  ar: {
    timeout: "استغرق المزوّد وقتًا أطول من اللازم للرد",
    rate_limited: "طلب المزوّد تقليل عدد الطلبات",
    quota_exhausted: "نفد الرصيد المجاني لدى المزوّد",
    budget_exhausted: "نفدت ميزانية الرموز لهذا الشهر",
    auth_failed: "رفض المزوّد مفتاح الواجهة البرمجية",
    model_unavailable: "النموذج المحدّد غير متاح",
    provider_error: "حدث خطأ لدى المزوّد",
    provider_unreachable: "تعذّر الوصول إلى المزوّد",
    malformed_response: "ردّ المزوّد غير صالح للاستخدام",
    invalid_output: "الردّ ليس بصيغة JSON صحيحة",
    truncated: "انقطع الردّ قبل اكتماله",
    lease_expired: "توقّفت المعالجة قبل أن تكتمل",
    inquiry_missing: "تعذّر تحميل الطلب",
    unknown: "حدثت مشكلة غير معروفة",
    ungrounded: "اقتبست المسودة وقائع غير موجودة في الملخص",
    unsupported: "تضمّنت المسودة أرقامًا لم يذكرها العميل",
    wrong_language: "كُتبت المسودة بلغة غير المطلوبة",
    schema: "لم تلتزم المسودة بالبنية المطلوبة",
  },
};

export function errorLabel(code: string | null | undefined, locale: Locale = "en"): string {
  const e = ERRORS[locale];
  if (!code) return e.unknown;
  if (code.startsWith("invalid_ungrounded")) return e.ungrounded;
  if (code.startsWith("invalid_unsupported")) return e.unsupported;
  if (code.startsWith("invalid_wrong_language")) return e.wrong_language;
  if (code.startsWith("invalid_schema")) return e.schema;
  return e[code] ?? code.replaceAll("_", " ");
}

export interface PreparationState {
  status: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  generator: string | null;
}

type Notice = { tone: Tone; title: string; detail: string };

const NOTICES = {
  en: {
    none: ["No preparation job", "This inquiry has no preparation record. Prepare it manually."],
    failed: ["Automated preparation failed", (a: number, m: number, err: string) => `Stopped after ${a} of ${m} attempts: ${err}. Prepare it manually, or retry.`],
    paused: ["Automation is paused", (err: string) => `Paused because ${err}. Prepare it manually, or resume automation once that is resolved.`],
    waitingOff: ["Waiting for manual preparation", "Automated preparation is turned off. Prepare it manually."],
    waitingPaused: ["Waiting: automation is paused", (err: string) => `Automation is paused because ${err}. Prepare it manually, or resume automation.`],
    queued: ["Queued for automated preparation", "It will be prepared on the next worker run."],
    retrying: ["Retrying automatically", (a: number, m: number, err: string, next: string) => `Attempt ${a} of ${m} failed (${err}). Next try ${next}.`],
    running: ["Preparing now", "A draft is being generated."],
    manual: ["Prepared manually", "The team is preparing this inquiry by hand."],
    succeeded: ["Draft generated", "Review and edit it before it is used."],
    unknown: "Unknown preparation state",
  },
  ar: {
    none: ["لا يوجد سجل تحضير", "لا يوجد سجل تحضير لهذا الطلب. حضّره يدويًا."],
    failed: ["فشل التحضير الآلي", (a: number, m: number, err: string) => `توقّف بعد ${a} من ${m} محاولات. السبب: ${err}. حضّره يدويًا أو أعد المحاولة.`],
    paused: ["التحضير الآلي متوقف مؤقتًا", (err: string) => `توقّف مؤقتًا. السبب: ${err}. حضّره يدويًا، أو استأنف التحضير الآلي بعد حلّ المشكلة.`],
    waitingOff: ["بانتظار التحضير اليدوي", "التحضير الآلي غير مفعّل. حضّره يدويًا."],
    waitingPaused: ["بانتظار: التحضير الآلي متوقف مؤقتًا", (err: string) => `التحضير الآلي متوقف مؤقتًا. السبب: ${err}. حضّره يدويًا أو استأنف التحضير الآلي.`],
    queued: ["في قائمة التحضير الآلي", "سيُحضَّر في دورة المعالجة التالية."],
    retrying: ["إعادة المحاولة تلقائيًا", (a: number, m: number, err: string, next: string) => `فشلت المحاولة ${a} من ${m}. السبب: ${err}. المحاولة التالية ${next}.`],
    running: ["جارٍ التحضير الآن", "يجري إنشاء مسودة."],
    manual: ["يُحضَّر يدويًا", "يحضّر الفريق هذا الطلب يدويًا."],
    succeeded: ["أُنشئت مسودة", "راجعها وعدّلها قبل استخدامها."],
    unknown: "حالة تحضير غير معروفة",
  },
} as const;

export function preparationNotice(
  prep: PreparationState | null,
  automation: { enabled: boolean; provider?: string; paused: readonly { provider: string; paused_reason: string | null }[] },
  locale: Locale = "en",
): Notice {
  const n = NOTICES[locale];
  const err = (code: string | null) => errorLabel(code, locale);
  const plain = ([title, detail]: readonly [string, string], tone: Tone): Notice => ({ tone, title, detail });
  if (!prep) return plain(n.none, "attention");
  const pausedHere = automation.paused.find((p) => p.provider === (prep.generator ?? automation.provider));
  switch (prep.status) {
    case "failed":
      return { tone: "attention", title: n.failed[0], detail: n.failed[1](prep.attempts, prep.max_attempts, err(prep.last_error)) };
    case "paused":
      return { tone: "attention", title: n.paused[0], detail: n.paused[1](err(prep.last_error)) };
    case "queued":
    case "retry_scheduled":
      if (!automation.enabled) return plain(n.waitingOff, "attention");
      if (pausedHere) return { tone: "attention", title: n.waitingPaused[0], detail: n.waitingPaused[1](err(pausedHere.paused_reason)) };
      return prep.status === "queued"
        ? plain(n.queued, "info")
        : { tone: "info", title: n.retrying[0], detail: n.retrying[1](prep.attempts, prep.max_attempts, err(prep.last_error), new Date(prep.next_attempt_at).toUTCString()) };
    case "running":
      return plain(n.running, "info");
    case "manual":
      return plain(n.manual, "ok");
    case "succeeded":
      return plain(n.succeeded, "ok");
    default:
      return { tone: "attention", title: n.unknown, detail: prep.status };
  }
}

const LABELS = {
  en: {
    review: { draft: "Draft", in_review: "Ready for review", approved: "Approved for the meeting", superseded: "Superseded" },
    meeting: { not_booked: "Not booked", booked: "Booked", cancelled: "Cancelled", completed: "Completed", no_show: "No show" },
    preparation: { queued: "Queued", running: "Preparing", retry_scheduled: "Retrying", succeeded: "Draft generated", failed: "Failed", paused: "Paused", manual: "Manual" },
    lead: { new: "New", reviewing: "Reviewing", qualified: "Qualified", converted: "Converted", not_a_fit: "Not a fit", archived: "Archived" },
    // The public form's controlled vocabulary (project_type_values constraint).
    projectType: { website: "Website", web_app: "Web app", mobile_app: "Mobile app", website_and_mobile: "Website and mobile app", other: "Other" },
    briefField: {
      "Project type": "Project type",
      "Budget range (client-stated)": "Budget range (client-stated)",
      "Timeline (client-stated)": "Timeline (client-stated)",
      Country: "Country",
      "Budget range": "Budget range",
      Timeline: "Timeline",
    },
  },
  ar: {
    review: { draft: "مسودة", in_review: "جاهزة للمراجعة", approved: "معتمدة للاجتماع", superseded: "نسخة سابقة" },
    meeting: { not_booked: "لم يُحجز", booked: "محجوز", cancelled: "أُلغي", completed: "تمّ", no_show: "لم يحضر" },
    preparation: { queued: "في الانتظار", running: "قيد التحضير", retry_scheduled: "إعادة محاولة", succeeded: "مسودة جاهزة", failed: "فشل", paused: "متوقف مؤقتًا", manual: "يدوي" },
    lead: { new: "جديد", reviewing: "قيد المراجعة", qualified: "مؤهَّل", converted: "أصبح عميلًا", not_a_fit: "غير مناسب", archived: "مؤرشف" },
    projectType: { website: "موقع إلكتروني", web_app: "تطبيق ويب", mobile_app: "تطبيق موبايل", website_and_mobile: "موقع وتطبيق موبايل", other: "أخرى" },
    briefField: {
      "Project type": "نوع المشروع",
      "Budget range (client-stated)": "الميزانية (كما ذكرها العميل)",
      "Timeline (client-stated)": "المدة الزمنية (كما ذكرها العميل)",
      Country: "الدولة",
      "Budget range": "الميزانية",
      Timeline: "المدة الزمنية",
    },
  },
} as const satisfies Record<Locale, Record<string, Record<string, string>>>;

export const labelsFor = (locale: Locale) => LABELS[locale] as { [K in keyof (typeof LABELS)["en"]]: Record<string, string> };

export const REVIEW_LABELS: Record<string, string> = LABELS.en.review;
export const MEETING_LABELS: Record<string, string> = LABELS.en.meeting;
export const PREPARATION_LABELS: Record<string, string> = LABELS.en.preparation;
export const LEAD_LABELS: Record<string, string> = LABELS.en.lead;
export const PROJECT_TYPE_LABELS: Record<string, string> = LABELS.en.projectType;

export const label = (labels: Record<string, string>, value: string | null | undefined, fallback = "None") =>
  value ? (labels[value] ?? value.replaceAll("_", " ")) : fallback;

// The list receives the first `max` characters of each description; end a
// cut-off excerpt at a word boundary with an ellipsis rather than mid-word.
export function excerpt(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,،؛:;-]+$/u, "")}…`;
}
