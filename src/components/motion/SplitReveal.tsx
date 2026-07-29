"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.2, 0.7, 0.2, 1] as const;

const wordVariants: Variants = {
  hidden: { y: "0.35em", opacity: 0 },
  show: { y: "0em", opacity: 1 },
};

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
  const words = text.split(" ");
  const MotionTag = motion[Tag];

  const nodes: ReactNode[] = [];
  words.forEach((word, i) => {
    nodes.push(
      <motion.span
        key={`w-${i}`}
        className="inline-block"
        variants={wordVariants}
        transition={{ duration: 0.6, ease: easeOut, delay: delay + i * wordDelay }}
      >
        {word}
      </motion.span>,
    );
    if (i < words.length - 1) nodes.push(" ");
  });

  return (
    <MotionTag
      key={text}
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
    >
      {nodes}
    </MotionTag>
  );
}
