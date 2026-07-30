export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-56 rounded-lg bg-secondary/60" />
        <div className="mt-2 h-4 w-40 rounded bg-secondary/40" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass h-24 rounded-xl" />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="glass h-64 rounded-xl lg:col-span-2" />
        <div className="glass h-64 rounded-xl" />
      </div>
    </div>
  );
}