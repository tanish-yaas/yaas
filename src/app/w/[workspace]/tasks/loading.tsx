export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl animate-pulse">
      <div className="mb-6">
        <div className="h-9 w-32 rounded-lg bg-secondary/60" />
        <div className="mt-2 h-4 w-28 rounded bg-secondary/40" />
      </div>
      <div className="glass h-20 rounded-xl" />
      <div className="mt-6 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}