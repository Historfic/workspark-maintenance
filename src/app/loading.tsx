export default function Loading() {
  return (
    <div className="min-h-dvh" role="status">
      <span className="sr-only">Loading work orders…</span>
      <div className="h-14 bg-ink" />
      <div className="mx-auto grid max-w-[96rem] items-start gap-6 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-[20rem_1fr] xl:grid-rows-[auto_1fr]">
        <div className="h-80 animate-pulse rounded border border-line bg-surface shadow-card" />
        <div className="order-last h-64 animate-pulse rounded border border-line bg-surface shadow-card md:order-none xl:col-start-1" />
        <div className="flex flex-col gap-6 md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="h-[84px] animate-pulse rounded border border-line bg-surface shadow-card"
                />
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <div className="h-44 animate-pulse rounded border border-line bg-surface shadow-card" />
              <div className="h-44 animate-pulse rounded border border-line bg-surface shadow-card" />
            </div>
          </div>
          <div className="space-y-3 rounded border border-line bg-surface p-4 shadow-card">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-bg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
