"use client";

import { useTransition } from "react";
import { deleteEvent } from "@/server/actions/events";

export function EventChip({
  id,
  label,
  time,
  kind,
}: {
  id: string;
  label: string;
  time: string | null;
  kind: "event" | "task";
}) {
  const [pending, startTransition] = useTransition();

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (kind !== "event") return;
    if (!confirm(`Delete "${label}"?`)) return;
    startTransition(async () => {
      await deleteEvent(id);
    });
  }

  return (
    <div
      onClick={remove}
      title={kind === "event" ? "Click to delete" : label}
      className={`truncate rounded px-1.5 py-0.5 text-[10px] leading-tight transition-opacity ${
        pending ? "opacity-40" : ""
      } ${
        kind === "event"
          ? "cursor-pointer bg-brand-violet/25 text-foreground hover:bg-brand-violet/40"
          : "bg-[#22D3EE]/20 text-[#22D3EE]"
      }`}
    >
      {time && <span className="opacity-70">{time} </span>}
      {label}
    </div>
  );
}