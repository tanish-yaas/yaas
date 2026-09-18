"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
        <AlertTriangle size={18} />
      </div>
      <div>
        <p className="text-sm">Something went wrong</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">
          This page failed to load. Trying again usually fixes it.
        </p>
        {/* Show what actually broke. A server error arrives here with its
            message replaced and a digest attached; a client error keeps its
            real message and has no digest. So the two are told apart by which
            of these appears, which is the first thing worth knowing. */}
        {error.digest ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/40">
            server · {error.digest}
          </p>
        ) : (
          error.message && (
            <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground/50">
              client · {error.message}
            </p>
          )
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
      >
        <RotateCw size={13} />
        Try again
      </button>
    </div>
  );
}