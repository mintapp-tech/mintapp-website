"use client";

import { useState } from "react";

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
      className="cursor-pointer rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white"
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
