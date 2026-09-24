"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Check, Plus, KeyRound, Pin, ChevronsUpDown } from "lucide-react";
import { setDefaultWorkspace } from "@/server/actions/workspaces";
import { anchorOf } from "@/lib/ui-scale";
import { BrandLockup } from "@/components/layout/brand";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  roleName: string;
  pending: boolean;
  href: string;
};

/** Everything the switcher needs, built once by the workspace layout. */
export type WorkspaceMenuData = {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  defaultWorkspaceId: string | null;
};

const MENU_WIDTH = 280;

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

/**
 * The brand lockup, doubling as the way between workspaces — top left, where
 * Slack and Linear keep theirs. It says where you are (the workspace name sits
 * under Nova) and, on a click, where else you could be.
 *
 * The menu portals to document.body. Rendered in place it was a positioned
 * child of the shell, and the page content — a later sibling in the same
 * stacking order — painted straight over it.
 */
export function WorkspaceSwitcher({
  current,
  workspaces,
  defaultWorkspaceId,
  compact = false,
  className = "",
}: WorkspaceMenuData & {
  /** The topbar's one-line version, for when the sidebar is not showing. */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: -9999,
    top: -9999,
    width: MENU_WIDTH,
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);

  // No mounted guard needed: the portal only renders once `open` is true, and
  // that can only come from a click, which only ever happens on the client.

  // Placed from the trigger's box, in the scaled root's space — which is the
  // space a fixed element under the zoomed root is positioned in.
  const place = useCallback(() => {
    if (!trigger.current) return;
    const rect = anchorOf(trigger.current);

    // Resized past the breakpoint that hides this copy of the trigger — the
    // other copy is the one on screen now, and this menu belongs to neither.
    if (rect.width === 0) {
      setOpen(false);
      return;
    }

    const width = Math.min(
      Math.max(MENU_WIDTH, rect.width),
      rect.viewportWidth - 24
    );

    setPosition({
      width,
      left: Math.max(12, Math.min(rect.left, rect.viewportWidth - width - 12)),
      top: rect.bottom + 6,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    // Follows the trigger through a resize rather than closing: phones fire
    // resize as their address bar slides, and a menu that shut on that would
    // shut under the finger reaching for it.
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  function pin(workspaceId: string) {
    setPendingId(workspaceId);
    startTransition(async () => {
      await setDefaultWorkspace(workspaceId);
      setPendingId(null);
    });
  }

  const menu = (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="menu"
        className="overlay fixed z-[9999] overflow-hidden"
        style={{ left: position.left, top: position.top, width: position.width }}
      >
        <div className="px-3 pb-1.5 pt-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
            Workspaces
          </p>
        </div>

        <div className="max-h-[calc(0.5*var(--vh))] overflow-y-auto pb-1">
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
    </>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${current.name}, switch workspace`}
        title={`${current.name} · switch workspace`}
        data-open={open}
        className={`group/switcher flex min-w-0 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-[var(--card-hover)] data-[open=true]:bg-[var(--card-hover)] ${className}`}
      >
        <BrandLockup
          size={compact ? 30 : 38}
          subtitle={current.name}
          subtitleLines={compact ? 1 : 2}
          className="min-w-0 flex-1"
        />
        <ChevronsUpDown
          size={14}
          className="shrink-0 text-faint transition-colors group-hover/switcher:text-foreground group-data-[open=true]/switcher:text-foreground"
        />
      </button>

      {open && createPortal(menu, document.body)}
    </>
  );
}
