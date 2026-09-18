import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/layout/brand";

/**
 * The shell every pre-workspace screen sits in. Shared so that choosing,
 * creating and joining feel like three steps of one thing rather than three
 * pages that happen to be next to each other.
 */
export function WelcomeFrame({
  eyebrow,
  title,
  blurb,
  back,
  children,
  footer,
}: {
  eyebrow: string;
  title: React.ReactNode;
  blurb: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div className="aurora-bg" aria-hidden />

      <main className="relative z-10 flex min-h-full items-center justify-center px-6 py-14">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <BrandLockup size={44} subtitle={null} />
          </div>

          <div className="panel px-7 py-8 backdrop-blur-xl">
            {back && (
              <Link
                href={back.href}
                className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-foreground"
              >
                <ArrowLeft size={13} />
                {back.label}
              </Link>
            )}

            <p className="text-[11px] uppercase tracking-[0.05em] text-primary">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {blurb}
            </p>

            <div className="mt-7">{children}</div>
          </div>

          {footer && (
            <div className="mt-5 text-center text-[12px] text-faint">{footer}</div>
          )}
        </div>
      </main>
    </>
  );
}

/** One consistent way to show what went wrong, on all three screens. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-destructive">
      {message}
    </div>
  );
}

export const welcomeInputClass =
  "w-full rounded-lg border border-border bg-secondary/60 px-3 py-2.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-violet";

export const welcomeButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-[13px] font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50";
