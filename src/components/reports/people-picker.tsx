"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { toZoomed, viewportSize, type AnchorRect } from "@/lib/ui-scale";
import type { ReportPerson } from "@/lib/reports";

const WIDTH = 280;

/**
 * Whose work the report covers. An empty selection is "everyone", which is
 * also what a member who may only see themselves is shown: their one name.
 *
 * Portals to the body like every overlay here: the toolbar sits inside a
 * backdrop-filter, which would trap a fixed panel.
 */
export function PeoplePicker({
  people,
  selected,
  selfId,
  onChange,
}: {
  people: ReportPerson[];
  selected: string[];
  selfId: string;
  onChange: (next: string[]) => void;
}) {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const chosen = people.filter((p) => selected.includes(p.userId));
  const label =
    chosen.length === 0
      ? "Everyone"
      : chosen.length === 1
        ? chosen[0].userId === selfId
          ? "Just me"
          : chosen[0].name
        : `${chosen.length} people`;

  return (
    <>
      <button
        type="button"
        data-on={chosen.length > 0}
        onClick={(e) => {
          const rect = toZoomed(e.currentTarget.getBoundingClientRect(), e.currentTarget);
          setAnchor((current) => (current ? null : rect));
        }}
        className="pill pill-sm max-w-[14rem]"
        aria-haspopup="listbox"
        aria-expanded={!!anchor}
      >
        {chosen.length === 1 ? (
          <Avatar
            avatarUrl={chosen[0].avatarUrl}
            image={chosen[0].image}
            name={chosen[0].name}
            size={16}
          />
        ) : (
          <Users size={13} className="shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>

      {anchor && (
        <Panel
          anchor={anchor}
          people={people}
          selected={selected}
          selfId={selfId}
          onChange={onChange}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

function Panel({
  anchor,
  people,
  selected,
  selfId,
  onChange,
  onClose,
}: {
  anchor: AnchorRect;
  people: ReportPerson[];
  selected: string[];
  selfId: string;
  onChange: (next: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: -9999, top: -9999 });
  const [query, setQuery] = useState("");
  // Edited locally and applied on close, so ticking four names is one
  // reload of the report rather than four.
  const [draft, setDraft] = useState<string[]>(selected);

  // The panel only exists after a click, so there is always a document to
  // portal into and measure against.
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 320;
    const view = viewportSize(ref.current);
    setPosition({
      left: Math.max(12, Math.min(anchor.left, view.width - WIDTH - 12)),
      top: Math.min(anchor.bottom + 8, view.height - height - 12),
    });
  }, [anchor]);

  // Read by the close handler, which is registered once per open.
  const draftRef = useRef(selected);

  useEffect(() => {
    const close = () => {
      const next = draftRef.current;
      const same =
        next.length === selected.length && next.every((id) => selected.includes(id));
      if (!same) onChange(next);
      onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const id = window.setTimeout(() => window.addEventListener("pointerdown", onPointer), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onChange, onClose, selected]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? people.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.email ?? "").toLowerCase().includes(q)
        )
      : people;
  }, [people, query]);

  const apply = (next: string[]) => {
    draftRef.current = next;
    setDraft(next);
  };

  const toggle = (id: string) => {
    const d = draftRef.current;
    apply(d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  };

  return createPortal(
    <div
      ref={ref}
      className="overlay fixed z-[94] flex max-h-[calc(0.7*var(--vh))] flex-col p-2"
      style={{ left: position.left, top: position.top, width: WIDTH }}
      role="listbox"
      aria-multiselectable
    >
      {people.length > 7 && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-[color-mix(in_oklab,white_9%,transparent)] px-2.5 py-1.5">
          <Search size={12} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find someone"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => apply([])}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[color-mix(in_oklab,white_5%,transparent)]"
      >
        <Tick on={draft.length === 0} />
        <Users size={14} className="text-faint" />
        <span className="flex-1">Everyone</span>
        <span className="text-[11px] text-faint">{people.length}</span>
      </button>

      <div className="my-1 border-t border-[color-mix(in_oklab,white_7%,transparent)]" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((p) => {
          const on = draft.includes(p.userId);
          return (
            <div
              key={p.userId}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[color-mix(in_oklab,white_5%,transparent)]"
            >
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(p.userId)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Tick on={on} />
                <Avatar avatarUrl={p.avatarUrl} image={p.image} name={p.name} size={18} />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {p.name}
                  {p.userId === selfId && <span className="text-faint"> · you</span>}
                  {p.left && <span className="text-faint"> · left</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => apply([p.userId])}
                className="hover-action shrink-0 text-[11px]"
                title={`Only ${p.name}`}
              >
                Only
              </button>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="px-2 py-3 text-[12px] text-faint">Nobody by that name.</p>
        )}
      </div>
    </div>,
    document.body
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors"
      style={{
        backgroundColor: on ? "var(--primary)" : "transparent",
        borderColor: "var(--primary)",
      }}
    >
      {on && <Check size={9} className="text-white" />}
    </span>
  );
}
