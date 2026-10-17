import { afterEach, describe, expect, test, vi } from "vitest";
import { scrollToSection, scrollToTop } from "./scroll";

// A Lenis stand-in whose cached position trails the page's: the page has been
// scrolled natively and Lenis has not seen the scroll event yet (#17).
function staleLenis(pageScroll: number) {
  const calls: string[] = [];
  const lenis = {
    animatedScroll: 0,
    resize() {
      calls.push("resize");
      lenis.animatedScroll = pageScroll;
    },
    scrollTo() {
      calls.push(`scrollTo from ${lenis.animatedScroll}`);
    },
  };
  return { lenis, calls };
}

afterEach(() => vi.unstubAllGlobals());

describe("section and top scrolling resync Lenis with the page before computing a destination", () => {
  test("scrollToSection", () => {
    const { lenis, calls } = staleLenis(547);
    const section = { id: "work" };
    vi.stubGlobal("window", { __lenis: lenis });
    vi.stubGlobal("document", { getElementById: (id: string) => (id === "work" ? section : null) });
    scrollToSection("work");
    expect(calls).toEqual(["resize", "scrollTo from 547"]);
  });

  test("scrollToTop", () => {
    const { lenis, calls } = staleLenis(547);
    vi.stubGlobal("window", { __lenis: lenis });
    scrollToTop();
    expect(calls).toEqual(["resize", "scrollTo from 547"]);
  });
});
