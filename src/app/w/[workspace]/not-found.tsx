import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Compass size={18} />
      </div>
      <div>
        <p className="text-sm">Nothing here</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          That page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-secondary px-4 py-2 text-xs transition-colors hover:bg-secondary/70"
      >
        Back to dashboard
      </Link>
    </div>
  );
}