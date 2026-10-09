"use client";

import { useState } from "react";
import { primary } from "./ui";

export default function CopyButton({ text, label, copied, failed }: { text: string; label: string; copied: string; failed: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
      className={`${primary} px-5 py-2.5 text-[14px]`}
    >
      <span aria-live="polite">{state === "copied" ? copied : state === "failed" ? failed : label}</span>
    </button>
  );
}
