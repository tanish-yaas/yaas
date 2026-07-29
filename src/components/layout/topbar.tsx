import { Search, Bell } from "lucide-react";
import { signOut } from "@/auth";

export function Topbar({
  displayName,
  email,
  roleName,
  image,
}: {
  displayName: string;
  email: string;
  roleName: string;
  image?: string | null;
}) {
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border/60 px-4 backdrop-blur-xl md:px-6">
      <button
        type="button"
        className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 text-left text-xs text-muted-foreground transition-colors hover:border-brand-violet/40 md:max-w-sm"
      >
        <Search size={14} />
        Search tasks, events, people
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <Bell size={16} />
        </button>

        <div className="flex items-center gap-2.5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-8 w-8 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-violet/20 text-xs font-medium text-brand-violet">
              {initial}
            </div>
          )}
          <div className="hidden leading-tight sm:block">
            <p className="text-xs">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">{roleName}</p>
          </div>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}