"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useScrollReveal } from "./scroll-reveal";

export function SplitReveal({
  text,
  className,
  as: Tag = "span",
  delay = 0,
  wordDelay = 0.045,
}: {
  text: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3";
  delay?: number;
  wordDelay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useScrollReveal(ref);
  const words = text.split(" ");

  const nodes: ReactNode[] = [];
  words.forEach((word, i) => {
    const style = { "--mt-delay": `${(delay + i * wordDelay).toFixed(3)}s` } as CSSProperties;
    nodes.push(
      <span key={`w-${i}`} className="mt-word" style={style}>
        {word}
      </span>,
    );
    if (i < words.length - 1) nodes.push(" ");
  });

  return (
    <Tag key={text} ref={ref as React.Ref<never>} className={className}>
      {nodes}
    </Tag>
  );
}
