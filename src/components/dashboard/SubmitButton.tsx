"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// A submit button that shows its form is being processed and cannot be
// pressed twice. The accessible name stays the same while pending.
export default function SubmitButton({ children, className }: { children: ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={className}>
      {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
