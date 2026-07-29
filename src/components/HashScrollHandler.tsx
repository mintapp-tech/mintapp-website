"use client";

import { useEffect } from "react";
import { scrollToSection } from "@/lib/scroll";

export default function HashScrollHandler() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    let attempts = 0;
    const tryScroll = () => {
      attempts += 1;
      const el = document.getElementById(hash);
      if (el) {
        // Lenis is a single persistent instance across client-side route
        // changes, so it may still have the previous (shorter) page's
        // scroll bounds cached — force it to remeasure this page first.
        window.__lenis?.resize();
        scrollToSection(hash);
      } else if (attempts < 20) {
        requestAnimationFrame(tryScroll);
      }
    };
    requestAnimationFrame(tryScroll);
  }, []);

  return null;
}
