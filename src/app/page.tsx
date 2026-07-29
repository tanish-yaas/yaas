import { prisma } from "@/lib/prisma";

export default async function Home() {
  const userCount = await prisma.user.count();

  return (
    <main className="aurora flex min-h-screen items-center justify-center px-6">
      <div className="glass flex flex-col items-center gap-5 rounded-2xl px-10 py-12 text-center">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Milestone 1
        </span>
        <h1 className="text-gradient font-display text-6xl font-semibold tracking-tight">
          YAAS
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Connected to Supabase — {userCount} users in the database.
        </p>
      </div>
    </main>
  );
}