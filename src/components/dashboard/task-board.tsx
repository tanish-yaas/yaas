"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Flag, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/toast";
import { setTaskStatus } from "@/server/actions/tasks";

// Deferred: the sheet is the largest component in the app and the dashboard is
// the first page after login, so its JS should not be in that payload. It only
// mounts once a card is opened.
const TaskDetailSheet = dynamic(
  () =>
    import("@/components/tasks/task-detail-sheet").then(
      (m) => m.TaskDetailSheet
    ),
  { ssr: false }
);
import {
  accentFor,
  BOARD_COLUMNS,
  columnForStatus,
  type BoardTask,
} from "./board-columns";

/**
 * Status board for the dashboard. Cards drag between columns and the drop
 * writes straight through to setTaskStatus.
 *
 * Dates arrive pre-formatted from the server. The app is pinned to IST and the
 * browser is not, so formatting here would both drift and mismatch on hydration.
 */
export function TaskBoard({ tasks }: { tasks: BoardTask[] }) {
  const { push } = useToast();
  const [, startTransition] = useTransition();

  // Optimistic so a drop lands instantly. revalidatePath inside the action
  // refreshes the server copy underneath, and this unwinds onto it.
  const [optimistic, moveOptimistic] = useOptimistic(
    tasks,
    (current: BoardTask[], move: { id: string; status: string }) =>
      current.map((t) =>
        t.id === move.id ? { ...t, status: move.status } : t
      )
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<string, BoardTask[]>(
      BOARD_COLUMNS.map((c) => [c.key, []])
    );
    for (const task of optimistic) {
      const column = columnForStatus(task.status);
      if (column) map.get(column)!.push(task);
    }
    return map;
  }, [optimistic]);

  function drop(columnKey: string) {
    const id = draggingId;
    setDraggingId(null);
    setOverColumn(null);
    if (!id) return;

    const task = optimistic.find((t) => t.id === id);
    if (!task) return;

    // Same column is a no-op rather than a write. It also preserves BLOCKED,
    // which shares the In progress column and would otherwise be flattened.
    if (columnForStatus(task.status) === columnKey) return;

    const nextStatus = BOARD_COLUMNS.find((c) => c.key === columnKey)?.writes;
    if (!nextStatus) return;

    startTransition(async () => {
      moveOptimistic({ id, status: nextStatus });
      const result = await setTaskStatus(id, nextStatus);
      if (result?.error) push(result.error, "error");
    });
  }

  return (
    <>
    {/* items-start so each column is as tall as its own cards. Stretching them
        to a common height is what left the dead space under the board. */}
    <div className="-mx-1 flex items-start gap-2.5 overflow-x-auto px-1 pb-1">
      {BOARD_COLUMNS.map((column) => {
        const items = byColumn.get(column.key) ?? [];
        const active = overColumn === column.key;

        return (
          <section
            key={column.key}
            // Highlight is driven off dragOver rather than enter/leave pairs:
            // those also fire for every card inside the column, and a counter
            // shared across columns desyncs as the pointer crosses between them.
            // dragOver repeats while the pointer is here, so it cannot drift.
            onDragOver={(e) => {
              e.preventDefault();
              if (overColumn !== column.key) setOverColumn(column.key);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(column.key);
            }}
            className={`flex w-[260px] shrink-0 flex-col rounded-xl border p-2 transition-colors ${
              active
                ? "border-[color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color-mix(in_oklab,var(--primary)_7%,transparent)]"
                : "border-[color-mix(in_oklab,white_7%,transparent)] bg-[color-mix(in_oklab,white_2%,transparent)]"
            }`}
          >
            <header className="mb-2 flex items-center gap-2 px-1">
              <span
                className="chip"
                style={{
                  backgroundColor: `color-mix(in oklab, ${column.color} 20%, transparent)`,
                  borderColor: `color-mix(in oklab, ${column.color} 42%, transparent)`,
                  color: `color-mix(in oklab, ${column.color} 55%, white)`,
                }}
              >
                {column.label}
              </span>
              <span className="text-[11px] tabular-nums text-faint">
                {items.length}
              </span>
            </header>

            {/* min-h keeps an empty column a big enough drop target to aim at. */}
            <div className="flex min-h-[52px] flex-col gap-1.5">
              {items.map((task) => (
                <Card
                  key={task.id}
                  task={task}
                  dragging={draggingId === task.id}
                  onDragStart={() => setDraggingId(task.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                  onOpen={() => setOpenId(task.id)}
                />
              ))}

              {items.length === 0 && (
                <p className="px-1 py-5 text-center text-[11px] text-faint">
                  {active ? "Drop here" : "Nothing here"}
                </p>
              )}
            </div>

            <Link
              href="/tasks"
              className="mt-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[12px] text-faint transition-colors hover:bg-[color-mix(in_oklab,white_5%,transparent)] hover:text-foreground"
            >
              <Plus size={12} />
              New task
            </Link>
          </section>
        );
      })}
    </div>

    {/* Same sheet the tasks page uses — it loads its own detail from the id,
        so opening a card here needs nothing extra passed down. Kept out of the
        tree until first open so the deferred chunk is not fetched on load. */}
    {openId && (
      <TaskDetailSheet taskId={openId} onClose={() => setOpenId(null)} />
    )}
    </>
  );
}

function Card({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  task: BoardTask;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const accent = accentFor(task);

  return (
    <article
      draggable
      onDragStart={(e) => {
        // Firefox refuses to start a drag without payload on the transfer.
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      // Browsers suppress the click that would otherwise follow a drag, so a
      // plain handler is enough to keep dragging and opening apart.
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      // The accent is carried by a left stripe and a dot rather than a tinted
      // background: at this card size a wash flattens the text contrast, and
      // the stripe still reads when several cards stack up.
      style={{
        borderLeftColor: accent,
        backgroundColor: `color-mix(in oklab, ${accent} 7%, color-mix(in oklab, var(--card) 78%, transparent))`,
      }}
      className={`cursor-grab rounded-lg border border-l-[3px] border-[color-mix(in_oklab,white_8%,transparent)] px-2.5 py-2 transition-opacity active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        {task.blocked ? (
          <Flag
            size={11}
            className="mt-[3px] shrink-0 text-[var(--status-red)]"
            aria-label="Blocked"
          />
        ) : (
          <span
            className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <p className="min-w-0 flex-1 text-[13px] leading-snug">{task.title}</p>
      </div>

      {task.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="chip h-[18px] px-1.5 text-[10px]"
              style={{
                backgroundColor: `color-mix(in oklab, ${label.color} 20%, transparent)`,
                borderColor: `color-mix(in oklab, ${label.color} 40%, transparent)`,
                color: `color-mix(in oklab, ${label.color} 55%, white)`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {(task.dueLabel || task.assignees.length > 0) && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {task.dueLabel && (
            <span
              className={`chip h-[18px] px-1.5 text-[10px] ${
                task.overdue
                  ? "border-[color-mix(in_oklab,var(--status-red)_45%,transparent)] bg-[color-mix(in_oklab,var(--status-red)_18%,transparent)] text-[color-mix(in_oklab,var(--status-red)_60%,white)]"
                  : "border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] text-faint"
              }`}
            >
              {task.dueLabel}
            </span>
          )}

          {task.assignees.length > 0 && (
            <span className="ml-auto truncate text-[10px] text-faint">
              {task.assignees.join(", ")}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
