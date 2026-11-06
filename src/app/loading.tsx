export default function Loading() {
  return (
    <div className="min-h-dvh" aria-busy>
      <div className="h-14 border-b border-line bg-surface" />
      <div className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[22rem_1fr]">
        <div className="h-72 animate-pulse rounded border border-line bg-surface" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded border border-line bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
