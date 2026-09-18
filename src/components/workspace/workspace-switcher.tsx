"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Plus, KeyRound, Pin, ChevronDown } from "lucide-react";
import { setDefaultWorkspace } from "@/server/actions/workspaces";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  roleName: string;
  pending: boolean;
  href: string;
};

/** Two letters is enough to tell workspaces apart at 28px, and never wraps. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "W";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * A workspace's colour is derived from its handle, not stored.
 *
 * The handle is unique and stable, so the same workspace is the same colour on
 * every screen and every device, with nothing to migrate and no picker to
 * build. Hue only — saturation and lightness are fixed so none of them fight
 * the surface they sit on.
 */
function hue(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return h;
}

function WorkspaceMark({
  workspace,
  size = 26,
}: {
  workspace: Pick<WorkspaceOption, "name" | "slug" | "logoUrl">;
  size?: number;
}) {
  if (workspace.logoUrl) {
    return (
      <Image
        src={workspace.logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-md object-cover"
      />
    );
  }

  const h = hue(workspace.slug);

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(140deg, hsl(${h} 62% 46%), hsl(${(h + 34) % 360} 58% 34%))`,
        color: "white",
      }}
    >
      {initials(workspace.name)}
    </span>
  );
}

export function WorkspaceSwitcher({
  current,
  workspaces,
  defaultWorkspaceId,
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  defaultWorkspaceId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  // Click-away and Escape. Both, because a menu that only closes one way is a
  // menu that gets left open.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pin(workspaceId: string) {
    setPendingId(workspaceId);
    startTransition(async () => {
      await setDefaultWorkspace(workspaceId);
      setPendingId(null);
    });
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${current.name} · switch workspace`}
        className="flex h-9 items-center gap-2 rounded-lg border border-transparent px-1.5 transition-colors hover:border-border hover:bg-[var(--card-hover)]"
      >
        <Image
          src="/yaas-logo.png"
          alt="YAAS Nova"
          width={22}
          height={22}
          priority
          className="shrink-0 object-contain"
        />
        <span className="hidden max-w-[130px] truncate text-[12px] font-medium md:block">
          {current.name}
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="panel-solid absolute right-0 top-11 z-50 w-[272px] overflow-hidden rounded-xl border border-border shadow-2xl"
        >
          <div className="px-3 pb-1.5 pt-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
              Workspaces
            </p>
          </div>

          <div className="max-h-[300px] overflow-y-auto pb-1">
            {workspaces.map((w) => {
              const isCurrent = w.id === current.id;
              const isDefault = w.id === defaultWorkspaceId;

              return (
                <div
                  key={w.id}
                  className="group/ws flex items-center gap-2.5 px-2 py-1.5 transition-colors hover:bg-[var(--card-hover)]"
                >
                  <Link
                    href={w.href}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                    role="menuitem"
                  >
                    <WorkspaceMark workspace={w} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px]">{w.name}</span>
                        {isCurrent && (
                          <Check size={12} className="shrink-0 text-primary" />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-faint">
                        {w.pending ? "Waiting for approval" : w.roleName}
                        {isDefault && !w.pending && " · Default"}
                      </span>
                    </span>
                  </Link>

                  {/* Only meaningful for workspaces you are actually in, and
                      only worth showing once there is more than one to choose
                      between. */}
                  {!w.pending && workspaces.length > 1 && !isDefault && (
                    <button
                      type="button"
                      onClick={() => pin(w.id)}
                      disabled={pendingId === w.id}
                      title="Make this your default workspace"
                      className="shrink-0 rounded p-1 text-faint opacity-0 transition-all hover:bg-[var(--card-hover)] hover:text-foreground focus-visible:opacity-100 group-hover/ws:opacity-100 disabled:opacity-40"
                    >
                      <Pin size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-1">
            <Link
              href="/welcome/create"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[12.5px] transition-colors hover:bg-[var(--card-hover)]"
            >
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-faint">
                <Plus size={13} />
              </span>
              Create a workspace
            </Link>
            <Link
              href="/welcome/join"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[12.5px] transition-colors hover:bg-[var(--card-hover)]"
            >
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-faint">
                <KeyRound size={13} />
              </span>
              Join with an invite code
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
