"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useScrollReveal } from "./motion/scroll-reveal";

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "h1" | "h2" | "h3";
}) {
  const ref = useRef<HTMLElement>(null);
  useScrollReveal(ref);
  const style = delay ? ({ "--mt-delay": `${delay}s` } as CSSProperties) : undefined;
  return (
    <Tag ref={ref as React.Ref<never>} className={className ? `mt-reveal ${className}` : "mt-reveal"} style={style}>
      {children}
    </Tag>
  );
}

export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `mt-reveal-item ${className}` : "mt-reveal-item"}>{children}</div>;
}
