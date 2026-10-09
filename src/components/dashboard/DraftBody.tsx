// Renders a draft's plain text with its "## Heading" lines shown as headings.
// Text only: nothing is interpreted as HTML.
export default function DraftBody({ text }: { text: string }) {
  return (
    <div dir="auto" className="max-h-[560px] overflow-y-auto rounded-xl border border-line bg-canvas p-4 text-[14.5px] leading-[1.8]">
      {text.split("\n").map((line, i) => {
        const heading = /^#{1,4}\s+(.*)$/.exec(line.trim());
        if (heading)
          return (
            <p key={i} className="m-0 mt-3 text-[13px] font-bold tracking-[0.04em] text-ink uppercase first:mt-0">
              {heading[1]}
            </p>
          );
        return line.trim() ? (
          <p key={i} className="m-0 whitespace-pre-wrap">
            {line}
          </p>
        ) : null;
      })}
    </div>
  );
}
