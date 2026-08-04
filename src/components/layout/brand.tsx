/**
 * The YAAS mark sits in the corner as a badge; Nova is the product name.
 * Keep the mark square and fixed-width so it survives the sidebar collapsing
 * to an icon rail.
 */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[9px] border border-white/[0.14] bg-white/[0.04] font-display font-bold leading-none tracking-tight text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.26 }}
    >
      YAAS
    </span>
  );
}

export function BrandLockup({
  size = 34,
  subtitle,
}: {
  size?: number;
  subtitle?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="flex items-center gap-1.5">
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Nova
          </span>
          <span className="rounded bg-brand-violet/15 px-1.5 py-[3px] text-[9px] font-medium uppercase tracking-[0.12em] text-brand-violet">
            Beta
          </span>
        </span>
        {subtitle && (
          <span className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
