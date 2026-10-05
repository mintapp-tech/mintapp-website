"use client";

import { useState } from "react";
import { primary } from "./ui";

export default function CopyButton({ text, label }: { text: string; label: string }) {
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
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed. Allow clipboard access and try again." : label}</span>
    </button>
  );
}
