import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="aurora flex min-h-screen items-center justify-center px-6">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl px-10 py-12 text-center">
        <h1 className="text-gradient font-display text-4xl font-semibold tracking-tight">
          YAAS
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your workspace
        </p>
        <form
          className="w-full"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>
      </div>
    </main>
  );
}