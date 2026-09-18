import Image from "next/image";

export function YaasMark({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/yaas-logo.png"
      alt="YAAS"
      width={size}
      height={size}
      priority
      className={`object-contain ${className}`}
    />
  );
}

export function BrandLockup({
  size = 48,
  product = "Nova",
  badge = "BETA",
  subtitle = "Workspace",
  subtitleLines = 2,
  className = "",
}: {
  size?: number;
  product?: string;
  badge?: string | null;
  subtitle?: string | null;
  /** The subtitle is a workspace name, so its length is anyone's guess. Two
      lines keeps a long one readable in the sidebar; one keeps the topbar's
      height fixed. */
  subtitleLines?: 1 | 2;
  className?: string;
}) {
  // Spans throughout, not div and p: the lockup is also the workspace
  // switcher's button, and a button may only hold phrasing content.
  return (
    <span className={`flex items-center gap-3.5 ${className}`}>
      <YaasMark size={size} className="shrink-0" />

      <span className="h-9 w-px shrink-0 bg-border-strong" />

      <span className="block min-w-0 leading-tight">
        <span className="flex items-center gap-2">
          <span className="text-[17px] font-semibold tracking-tight">
            {product}
          </span>
          {badge && (
            <span className="rounded border border-brand-violet/50 bg-brand-violet/[0.12] px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-brand-violet">
              {badge}
            </span>
          )}
        </span>
        {subtitle && (
          <span
            className={`mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground ${
              subtitleLines === 1 ? "block truncate" : "line-clamp-2 break-words"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}