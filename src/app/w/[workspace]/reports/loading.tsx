export default function Loading() {
  return (
    <div className="w-full animate-pulse">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="h-8 w-32 rounded-lg bg-secondary/60" />
          <div className="mt-2 h-4 w-72 rounded bg-secondary/40" />
        </div>
        <div className="h-8 w-44 rounded-full bg-secondary/40" />
      </div>
      <div className="mb-4 h-9 w-full max-w-2xl rounded-full bg-secondary/40" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="stat h-[62px]" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel h-40" />
        ))}
      </div>
    </div>
  );
}
