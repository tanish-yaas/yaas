import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * The 404 outside any workspace — including the one a workspace layout throws
 * when the handle is unknown *or* you are not a member of it. Those two are
 * deliberately the same page: which handles exist is not something a stranger
 * gets to enumerate.
 */
export default function NotFound() {
  return (
    <>
      <div className="aurora-bg" aria-hidden />

      <main className="relative z-10 flex min-h-full items-center justify-center px-6">
        <div className="panel w-full max-w-sm px-8 py-10 text-center backdrop-blur-xl">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
            <Compass size={18} />
          </div>

          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            Nothing here
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            That workspace doesn&apos;t exist, or you&apos;re not a member of
            it. If someone sent you a link, you may need their invite code too.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Go to my workspace
            </Link>
            <Link
              href="/welcome/join"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border text-[12px] transition-colors hover:border-brand-violet/40"
            >
              Enter an invite code
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
