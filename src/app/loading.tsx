export default function Loading() {
  return (
    <div className="min-h-dvh" role="status">
      <span className="sr-only">Loading work orders…</span>
      <div className="h-14 bg-ink" />
      <div className="mx-auto grid max-w-[96rem] items-start gap-6 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-[20rem_1fr] xl:grid-rows-[auto_1fr]">
        <div className="h-80 animate-pulse rounded border border-line bg-surface shadow-card" />
        <div className="order-last h-64 animate-pulse rounded border border-line bg-surface shadow-card md:order-none xl:col-start-1" />
        <div className="space-y-3 rounded border border-line bg-surface p-4 shadow-card md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-bg" />
          ))}
        </div>
      </div>
    </div>
  );
}
