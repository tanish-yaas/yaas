import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  accent = "#7C5CFF",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}1a`, color: accent }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm">{title}</p>
        <p className="mx-auto mt-1 max-w-[22rem] text-xs leading-relaxed text-muted-foreground/70">
          {description}
        </p>
      </div>
    </div>
  );
}