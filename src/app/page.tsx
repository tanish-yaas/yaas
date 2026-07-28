import { Button } from "@/components/ui/button";

export default function Home() {
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
          Design system online — tokens, glass, aurora, and typography all
          wired up.
        </p>
        <Button size="lg">Primary button</Button>
      </div>
    </main>
  );
}