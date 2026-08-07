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
  className = "",
}: {
  size?: number;
  product?: string;
  badge?: string | null;
  subtitle?: string | null;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <YaasMark size={size} className="shrink-0" />

      <span className="h-9 w-px shrink-0 bg-border-strong" />

      <div className="leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-semibold tracking-tight">
            {product}
          </span>
          {badge && (
            <span className="rounded border border-brand-violet/50 bg-brand-violet/[0.12] px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-brand-violet">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}