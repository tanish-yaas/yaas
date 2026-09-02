export default function Loading() {
  return (
    <div className="w-full animate-pulse">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-6 w-40 rounded-full bg-secondary/50" />
        <div className="ml-auto h-6 w-32 rounded-full bg-secondary/50" />
      </div>

      <div className="mb-3 h-6 w-48 rounded bg-secondary/40" />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="stat h-[86px]" />
        ))}
      </div>

      <div className="panel mb-3 h-64" />

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <div className="panel h-56" />
        <div className="panel h-56" />
      </div>

      <div className="panel h-64" />
    </div>
  );
}
