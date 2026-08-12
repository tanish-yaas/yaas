"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, EyeOff, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { toZoomed, viewportSize, type AnchorRect } from "@/lib/ui-scale";

const WIDTH = 260;

/**
 * Pseudo-person for tasks nobody owns. Without an entry of its own an
 * unassigned task matches no selection and drops off the board silently, which
 * is exactly the work most worth seeing.
 */
export const UNASSIGNED_ID = "__unassigned__";

export type BoardMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  image: string | null;
};

/**
 * Which people's tasks the board shows. Only rendered for viewers whose task
 * scope reaches past their own rows, so for everyone else the board keeps the
 * single-owner behaviour and no control appears.
 *
 * Modelled on the calendar's panel, down to portalling to the body — the panel
 * classes set backdrop-filter, which traps fixed positioning in a descendant.
 */
export function PeopleFilter({
  members,
  selected,
  selfId,
  onToggle,
  onOnly,
}: {
  members: BoardMember[];
  selected: Set<string>;
  selfId: string;
  onToggle: (userId: string) => void;
  onOnly: (userId: string) => void;
}) {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  // "Just me" is the default, so it needs no badge and no highlight.
  const isDefault = selected.size === 1 && selected.has(selfId);

  return (
    <>
      {/* Icon only. The label used to spell out the selection, which cost a
          whole row above the columns for something glanced at rarely — the
          count badge carries the same information. */}
      <button
        type="button"
        data-on={!isDefault}
        // Measured before setState — see the same note in calendar-shell.
        // currentTarget is null by the time an updater runs. Converted on the
        // way in so the panel, which lays out inside the scaled root, never
        // sees a screen-space rect.
        onClick={(e) => {
          const rect = toZoomed(
            e.currentTarget.getBoundingClientRect(),
            e.currentTarget
          );
          setAnchor((current) => (current ? null : rect));
        }}
        title={
          isDefault
            ? "Showing your tasks · pick whose to show"
            : `Showing ${selected.size} of ${members.length}`
        }
        aria-label="Whose tasks to show"
        className="icon-btn relative"
      >
        <Users size={14} />
        {!isDefault && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-medium tabular-nums text-white">
            {selected.size}
          </span>
        )}
      </button>

      {anchor && (
        <Panel
          anchor={anchor}
          members={members}
          selected={selected}
          selfId={selfId}
          onToggle={onToggle}
          onOnly={onOnly}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

function Panel({
  anchor,
  members,
  selected,
  selfId,
  onToggle,
  onOnly,
  onClose,
}: {
  anchor: AnchorRect;
  members: BoardMember[];
  selected: Set<string>;
  selfId: string;
  onToggle: (userId: string) => void;
  onOnly: (userId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: -9999, top: -9999 });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const height = ref.current?.offsetHeight ?? 280;
    // offsetHeight and the anchor are both in the scaled root's space, so the
    // window has to be measured there too or the clamp drifts with the scale.
    const view = viewportSize(ref.current);

    setPosition({
      left: Math.max(
        12,
        Math.min(anchor.right - WIDTH, view.width - WIDTH - 12)
      ),
      top: Math.min(anchor.bottom + 8, view.height - height - 12),
    });
  }, [anchor, mounted]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Deferred, or the click that opened the panel closes it again.
    const id = window.setTimeout(
      () => window.addEventListener("pointerdown", onPointer),
      0
    );
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={ref}
      className="overlay fixed z-[94] max-h-[calc(0.7*var(--vh))] overflow-y-auto p-3"
      style={{ left: position.left, top: position.top, width: WIDTH }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.12em] text-faint">
          Whose tasks
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-faint transition-colors hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {members.map((member) => {
          const visible = selected.has(member.userId);

          return (
            <div
              key={member.userId}
              className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-[color-mix(in_oklab,white_5%,transparent)]"
            >
              <button
                type="button"
                onClick={() => onToggle(member.userId)}
                title={visible ? "Hide their tasks" : "Show their tasks"}
                className="flex shrink-0 items-center"
              >
                <span
                  className="flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors"
                  style={{
                    backgroundColor: visible ? "var(--primary)" : "transparent",
                    borderColor: "var(--primary)",
                  }}
                >
                  {visible && <Check size={9} className="text-white" />}
                </span>
              </button>

              <Avatar
                avatarUrl={member.avatarUrl}
                image={member.image}
                name={member.name}
                size={18}
              />

              <span className="min-w-0 flex-1 truncate text-[13px]">
                {member.name}
                {member.userId === selfId && (
                  <span className="text-faint"> · you</span>
                )}
              </span>

              <button
                type="button"
                onClick={() => onOnly(member.userId)}
                title="Only this person"
                className="hover-action shrink-0"
              >
                {visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
          );
        })}

        <div className="mt-1 border-t border-[color-mix(in_oklab,white_7%,transparent)] pt-1">
          <div className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-[color-mix(in_oklab,white_5%,transparent)]">
            <button
              type="button"
              onClick={() => onToggle(UNASSIGNED_ID)}
              title="Tasks with nobody on them"
              className="flex shrink-0 items-center"
            >
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors"
                style={{
                  backgroundColor: selected.has(UNASSIGNED_ID)
                    ? "var(--primary)"
                    : "transparent",
                  borderColor: "var(--primary)",
                }}
              >
                {selected.has(UNASSIGNED_ID) && (
                  <Check size={9} className="text-white" />
                )}
              </span>
            </button>

            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-dashed border-[color-mix(in_oklab,white_25%,transparent)]" />

            <span className="min-w-0 flex-1 truncate text-[13px] text-faint">
              Unassigned
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
