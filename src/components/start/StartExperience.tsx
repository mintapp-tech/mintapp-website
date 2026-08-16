"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { Reveal } from "@/components/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";

const easeOut = [0.2, 0.7, 0.2, 1] as const;

const DAY_NAMES = {
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const MONTH_NAMES = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const TIME_SLOTS = ["10:00", "11:30", "13:00", "15:00", "16:30"];

interface MeetingDate {
  key: string;
  label: string;
  dayLabel: string;
  dayNum: string;
}

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  desc: string;
}

const emptyForm: FormState = { name: "", company: "", email: "", phone: "", desc: "" };

const inputClass =
  "w-full rounded-[14px] border border-ink/[.14] bg-canvas px-4 py-3 text-[15.5px] text-ink placeholder:text-ink-faint transition-colors focus:border-mint-deep focus:outline-none";

export default function StartExperience() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const isAr = lang === "ar";

  const [form, setForm] = useState<FormState>(emptyForm);
  const [dates, setDates] = useState<MeetingDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);
  const [submitted, setSubmitted] = useState<{ name: string; dateLabel: string; time: string } | null>(null);

  useEffect(() => {
    const dayNames = DAY_NAMES[isAr ? "ar" : "en"];
    const monthNames = MONTH_NAMES[isAr ? "ar" : "en"];
    const next: MeetingDate[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1);
    let guard = 0;
    while (next.length < 6 && guard < 30) {
      const day = cursor.getDay();
      if (day !== 5 && day !== 6) {
        next.push({
          key: cursor.toDateString(),
          label: `${dayNames[day]} ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`,
          dayLabel: dayNames[day],
          dayNum: String(cursor.getDate()),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    // Intentional: meeting dates depend on the real client clock at visit time,
    // not the server prerender time, so they're computed post-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDates(next);
  }, [isAr]);

  const selectedDateLabel = useMemo(
    () => dates.find((d) => d.key === selectedDate)?.label ?? "",
    [dates, selectedDate],
  );

  const canSubmit = Boolean(
    form.name.trim() && form.email.trim() && form.desc.trim() && selectedDate && selectedTime && consent,
  );

  const updateField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setConsentTouched(true);
      return;
    }
    if (!canSubmit || !selectedTime) return;
    setSubmitted({ name: form.name.trim(), dateLabel: selectedDateLabel, time: selectedTime });
  };

  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-[clamp(34px,5vw,68px)] pb-[clamp(60px,8vw,110px)] sm:px-6">
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="mx-auto max-w-[640px] rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(32px,5vw,56px)] text-center"
          >
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-mint-soft px-4 py-1.5 text-[13px] font-semibold text-mint-deep">
              <span className="block h-1.5 w-1.5 rounded-full bg-mint-deep" />
              {t.success.badge}
            </span>
            <h1 className="m-0 text-[clamp(28px,3.6vw,42px)] font-semibold tracking-[-0.02em] text-balance">
              {t.success.title}
            </h1>
            <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">{t.success.copy}</p>

            <div className="mx-auto mt-8 max-w-[380px] rounded-2xl border border-ink/[.08] bg-canvas p-5 text-start">
              <div className="mb-2 font-manrope text-[11.5px] font-bold tracking-[.12em] text-mint-deep uppercase">
                {t.success.meeting}
              </div>
              <div className="text-[17px] font-semibold">{submitted.dateLabel}</div>
              <div className="text-[15px] text-ink-soft">{submitted.time}</div>
            </div>

            <div className="mx-auto mt-8 max-w-[440px] text-start">
              <div className="mb-3 text-[15px] font-semibold">{t.success.nextTitle}</div>
              <div className="flex flex-col gap-2.5">
                {t.success.next.map((point) => (
                  <div key={point} className="flex items-start gap-2.5 text-[14.5px] leading-[1.7] text-ink-soft">
                    <span className="mt-2 block h-[5px] w-[5px] flex-none rounded-full bg-mint-deep" />
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <Magnetic className="mx-auto mt-9 inline-block">
              <button
                onClick={() => router.push(`/${lang}`)}
                className="cursor-pointer rounded-full border-0 bg-ink px-8 py-[15px] text-[15.5px] font-semibold text-white transition-colors hover:bg-mint hover:text-dark"
              >
                {t.success.home}
              </button>
            </Magnetic>
            <p className="mt-5 text-[13px] text-ink-soft">{t.success.note}</p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <Reveal className="mx-auto max-w-[70ch] text-center">
              <h1 className="m-0 text-[clamp(30px,4vw,48px)] font-semibold leading-[1.16] tracking-[-0.02em] text-balance">
                {t.start.title}
              </h1>
              <p className="mx-auto mt-4 max-w-[56ch] text-[16.5px] leading-[1.85] text-ink-soft">{t.start.sub}</p>
            </Reveal>

            <div className="mt-[clamp(36px,5vw,60px)] grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
              <Reveal as="div">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(22px,3vw,36px)]">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fName}
                      <input required value={form.name} onChange={updateField("name")} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fCompany}{" "}
                      <span className="font-normal text-ink-faint">({t.start.optional})</span>
                      <input value={form.company} onChange={updateField("company")} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fEmail}
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={updateField("email")}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fPhone} <span className="font-normal text-ink-faint">({t.start.optional})</span>
                      <input value={form.phone} onChange={updateField("phone")} className={inputClass} />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                    {t.start.fDesc}
                    <span className="text-[13.5px] font-normal leading-[1.6] text-ink-soft">{t.start.fDescHelp}</span>
                    <textarea
                      required
                      value={form.desc}
                      onChange={updateField("desc")}
                      placeholder={t.start.fDescPh}
                      rows={5}
                      className={`${inputClass} resize-none`}
                    />
                  </label>

                  <div className="rounded-[14px] border border-ink/[.1] bg-canvas px-4 py-3.5">
                    <div className="mb-2 text-[13px] font-semibold text-ink">{t.start.confidentialTitle}</div>
                    <div className="flex flex-col gap-1.5">
                      {t.start.confidentialItems.map((item) => (
                        <div key={item} className="flex items-start gap-2 text-[13px] leading-[1.6] text-ink-soft">
                          <span className="mt-[7px] block h-[4px] w-[4px] flex-none rounded-full bg-ink-faint" />
                          {item}
                        </div>
                      ))}
                    </div>
                    <p className="m-0 mt-2.5 text-[12.5px] leading-[1.6] text-ink-faint">{t.start.confidentialNote}</p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="text-[14px] font-medium text-ink">{t.start.fDate}</div>
                    <div className="flex flex-wrap gap-2.5">
                      {dates.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setSelectedDate(d.key)}
                          className={`min-w-[88px] flex-1 rounded-[14px] border px-2.5 py-3.5 text-center text-[14px] transition-colors sm:flex-none ${
                            selectedDate === d.key
                              ? "border-ink bg-ink text-white"
                              : "border-ink/[.14] bg-canvas text-ink hover:border-ink/30"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="text-[14px] font-medium text-ink">{t.start.fTime}</div>
                    <div className="flex flex-wrap gap-2.5">
                      {TIME_SLOTS.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSelectedTime(time)}
                          className={`rounded-full border px-5 py-2.5 text-[14.5px] transition-colors ${
                            selectedTime === time
                              ? "border-ink bg-ink text-white"
                              : "border-ink/[.14] bg-canvas text-ink hover:border-ink/30"
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-[1.65] text-ink">
                      <input
                        type="checkbox"
                        required
                        checked={consent}
                        onChange={(e) => {
                          setConsent(e.target.checked);
                          setConsentTouched(true);
                        }}
                        aria-invalid={consentTouched && !consent}
                        aria-describedby={consentTouched && !consent ? "consent-error" : undefined}
                        className="mt-[3px] h-[18px] w-[18px] flex-none cursor-pointer rounded-[5px] border border-ink/[.3] bg-canvas text-mint-deep accent-mint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-deep"
                      />
                      <span>
                        {t.start.consentPrefix}
                        <Link
                          href={`/${lang}/privacy`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-dark underline decoration-mint decoration-[1.5px] underline-offset-4 transition-colors hover:text-mint-deep"
                        >
                          {t.start.consentLinkText}
                        </Link>
                        {t.start.consentSuffix}
                      </span>
                    </label>
                    {consentTouched && !consent && (
                      <p id="consent-error" role="alert" className="text-[13px] font-medium text-red-600">
                        {t.start.consentError}
                      </p>
                    )}
                  </div>

                  <Magnetic className={canSubmit ? "self-start" : "pointer-events-none self-start"}>
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className={`rounded-full border-0 px-8 py-[16px] text-[16px] font-semibold transition-colors ${
                        canSubmit
                          ? "cursor-pointer bg-ink text-white hover:bg-mint hover:text-dark"
                          : "cursor-not-allowed bg-ink/[.16] text-ink/45"
                      }`}
                    >
                      {t.start.cta}
                    </button>
                  </Magnetic>
                  <p className="text-[13px] text-ink-soft">{t.start.privacy}</p>
                </form>
              </Reveal>

              <Reveal as="div" delay={0.1}>
                <div className="rounded-[24px] border border-ink/[.08] bg-canvas p-[clamp(22px,3vw,30px)] lg:sticky lg:top-[100px]">
                  <div className="mb-4 text-[16px] font-semibold">{t.start.sideTitle}</div>
                  <div className="flex flex-col gap-4">
                    {t.start.sidePoints.map((point, i) => (
                      <div key={point.t} className="flex items-start gap-3.5">
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-dark font-manrope text-[13px] font-bold text-mint">
                          {i + 1}
                        </span>
                        <div>
                          <div className="mb-1 text-[15px] font-semibold">{point.t}</div>
                          <div className="text-[14px] leading-[1.7] text-ink-soft">{point.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 border-t border-ink/[.08] pt-4 text-[13.5px] leading-[1.7] text-ink-soft">{t.start.prepClarify}</p>
                  <p className="mt-3 text-[13px] text-ink-soft">{t.start.sideNote}</p>
                </div>
              </Reveal>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
