import { describe, expect, test } from "vitest";
import { en } from "./en";
import { ar } from "./ar";

describe("privacy policy: the budget currency's country lookup", () => {
  test("is explained in the approved words, in both languages", () => {
    expect(en.privacy.sections.map((s) => s.note).filter(Boolean)).toEqual(["Our hosting provider supplies a country code inferred from your connection. Mintapp uses it only to select the budget currency and does not store the country code or your IP address with your inquiry."]);
    expect(ar.privacy.sections.map((s) => s.note).filter(Boolean)).toEqual(["يزوّدنا مزود الاستضافة برمز الدولة المستنتج من اتصالك. تستخدمه Mintapp فقط لاختيار عملة نطاقات الميزانية، ولا تحفظ رمز الدولة أو عنوان IP ضمن طلبك."]);
  });

  test("the Turnstile disclosure names the IP address, in the approved words", () => {
    expect(en.privacy.processorsNote).toBe("Cloudflare Turnstile processes limited technical and security signals, including your IP address and browser information, to detect automated abuse. It does not read what you enter in the form. More detail is available in");
    expect(ar.privacy.processorsNote).toBe("تعالج خدمة Cloudflare Turnstile إشارات تقنية وأمنية محدودة، بما في ذلك عنوان IP ومعلومات المتصفح، لاكتشاف الاستخدام الآلي المسيء. ولا تقرأ ما تكتبه في النموذج. لمزيد من التفاصيل، راجع");
  });

  test("the country is not listed among the things collected, and the new fields are", () => {
    const list = (t: typeof en) => t.privacy.sections.flatMap((s) => s.list ?? []).join(" | ");
    expect(list(en)).not.toMatch(/country|IP address/i);
    expect(list(ar)).not.toMatch(/الدولة|عنوان IP/);
    expect(list(en)).toMatch(/estimated budget range and expected timeline/i);
    expect(list(en)).toMatch(/existing website or app/i);
    expect(list(ar)).toMatch(/الميزانية التقديرية/);
    expect(list(ar)).toMatch(/موقعك أو تطبيقك الحالي/);
  });
});
