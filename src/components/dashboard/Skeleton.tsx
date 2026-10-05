// Loading placeholders that match the layout of the page being loaded.
const bar = "animate-pulse rounded-md bg-ink/[0.07]";

export function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading inquiries">
      <div className={`${bar} h-3 w-36`} />
      <div className={`${bar} mt-3 mb-7 h-8 w-44`} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[78px] rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5 bg-surface p-5">
            <div className={`${bar} h-4 w-56`} />
            <div className={`${bar} h-3 w-full max-w-[520px]`} />
            <div className={`${bar} h-3 w-2/3 max-w-[360px]`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading inquiry">
      <div className={`${bar} h-3.5 w-28`} />
      <div className={`${bar} mt-6 h-3 w-40`} />
      <div className={`${bar} mt-3 h-8 w-72 max-w-full`} />
      <div className="mt-7 mb-5 h-[82px] rounded-2xl border border-line bg-surface" />
      <div className="mb-6 h-[92px] rounded-2xl border border-line bg-surface" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex h-[420px] flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
          <div className={`${bar} h-4 w-24`} />
          <div className={`${bar} h-3 w-full`} />
          <div className={`${bar} h-3 w-5/6`} />
          <div className={`${bar} h-24 w-full`} />
        </div>
        <div className="h-[260px] rounded-2xl border border-line bg-surface" />
      </div>
    </div>
  );
}
