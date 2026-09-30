import clsx from "clsx";

export function LogoMark({ size = 30, variant = "color" }: { size?: number; variant?: "color" | "white" }) {
  const height = size * (145 / 160);
  if (variant === "white") {
    return (
      <svg width={size} height={height} viewBox="0 0 160 145" className="block flex-none" aria-hidden>
        <polygon points="20,10 80,60 80,95 20,45" fill="#FFFFFF" />
        <polygon points="140,10 80,60 80,95 140,45" fill="#FFFFFF" />
        <polygon points="20,56 55,85 55,135 20,135" fill="#FFFFFF" />
        <polygon points="105,85 140,56 140,135 105,135" fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <svg width={size} height={height} viewBox="0 0 160 145" className="block flex-none" aria-hidden>
      <polygon points="20,10 80,60 80,95 20,45" fill="#32E6A6" />
      <polygon points="140,10 80,60 80,95 140,45" fill="#32E6A6" />
      <polygon points="80,60 105,80 80,95" fill="#0A6B50" />
      <polygon points="20,56 55,85 55,135 20,135" fill="#071B16" />
      <polygon points="105,85 140,56 140,135 105,135" fill="#32E6A6" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <>
      <LogoMark size={30} variant={light ? "white" : "color"} />
      <span
        className={clsx("font-manrope text-[19px] font-bold tracking-[-0.03em]", light ? "text-canvas" : "text-ink")}
      >
        mintapp
      </span>
    </>
  );
}
