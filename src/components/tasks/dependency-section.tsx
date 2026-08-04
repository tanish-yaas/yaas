"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  addDependency,
  removeDependency,
  searchTasksForDependency,
} from "@/server/actions/dependencies";
import type { DependencyRow } from "@/server/services/task-detail";

type Hit = { id: string; title: string; status: string };

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-violet";

export function DependencySection({
  taskId,
  direction,
  rows,
  canEdit,
  onChanged,
}: {
  taskId: string;
  direction: "blocked-by" | "blocks";
  rows: DependencyRow[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!picking) return;

    const id = ++requestId.current;
    setSearching(true);

    const timer = window.setTimeout(async () => {
      const results = await searchTasksForDependency(taskId, query);
      // Ignore anything the user has already typed past.
      if (id === requestId.current) {
        setHits(results);
        setSearching(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [picking, query, taskId]);

  function link(otherTaskId: string) {
    startTransition(async () => {
      const result = await addDependency(taskId, otherTaskId, direction);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      setPicking(false);
      setQuery("");
      await onChanged();
    });
  }

  function unlink(dependencyId: string) {
    startTransition(async () => {
      const result = await removeDependency(dependencyId);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      await onChanged();
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className="group flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5"
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                row.done
                  ? "border-[#4ADE80] bg-[#4ADE80]/20 text-[#4ADE80]"
                  : "border-border"
              }`}
            >
              {row.done && <Check size={8} />}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-xs ${
                row.done ? "text-muted-foreground line-through" : ""
              }`}
            >
              {row.title}
            </span>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
              {row.status.replace("_", " ")}
            </span>
            {canEdit && (
              <button
                type="button"
                disabled={pending}
                onClick={() => unlink(row.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                aria-label="Remove link"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {rows.length === 0 && !picking && (
          <p className="text-[11px] text-muted-foreground/70">
            {direction === "blocked-by"
              ? "Nothing is holding this up."
              : "This isn't holding anything up."}
          </p>
        )}
      </div>

      {canEdit &&
        (picking ? (
          <div className="mt-2 rounded-lg border border-brand-violet/30 bg-brand-violet/5 px-2.5 py-2.5">
            <div className="flex items-center gap-2">
              <Search size={12} className="shrink-0 text-muted-foreground" />
              <input
                value={query}
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPicking(false);
                }}
                placeholder="Search tasks…"
                className={field}
              />
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>

            <div className="mt-2 flex max-h-44 flex-col overflow-y-auto">
              {searching && (
                <p className="px-1 py-2 text-[11px] text-muted-foreground">
                  Searching…
                </p>
              )}
              {!searching && hits.length === 0 && (
                <p className="px-1 py-2 text-[11px] text-muted-foreground">
                  No matching tasks.
                </p>
              )}
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  disabled={pending}
                  onClick={() => link(hit.id)}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {hit.title}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {hit.status.replace("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-brand-violet hover:text-foreground"
          >
            <Plus size={10} />
            {direction === "blocked-by" ? "Add blocker" : "Add blocked task"}
          </button>
        ))}
    </div>
  );
}
