/** Casing shared by every settings section: panel, header bar, padded body. */
export function SettingsPanel({
  id,
  title,
  icon,
  description,
  action,
  dimmed = false,
  children,
}: {
  /** For linking straight to a section: /settings#reminders. */
  id?: string;
  title: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`panel scroll-mt-6 overflow-hidden transition-opacity ${
        dimmed ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-faint">
          {icon}
          {title}
        </h2>
        {action}
      </div>

      <div className="px-4 py-4">
        {description && (
          <p className="mb-4 text-[12px] leading-relaxed text-faint">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
