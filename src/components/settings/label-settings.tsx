"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Tag, Trash2, X } from "lucide-react";
import { theme } from "@/config/theme";
import { useToast } from "@/components/ui/toast";
import { createLabel, deleteLabel, updateLabel } from "@/server/actions/labels";

export type LabelRow = {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  canManage: boolean;
};

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-violet";

function Swatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {theme.labelPalette.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={color}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110 ${
            value === color ? "ring-2 ring-white/50 ring-offset-2 ring-offset-card" : ""
          }`}
          style={{ backgroundColor: color }}
        >
          {value === color && <Check size={11} className="text-white" />}
        </button>
      ))}
    </div>
  );
}

export function LabelSettings({ labels }: { labels: LabelRow[] }) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(theme.labelPalette[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(theme.labelPalette[0]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function submitNew() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createLabel(name, color);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      setName("");
      setAdding(false);
      push("Label created");
    });
  }

  function submitEdit(id: string) {
    startTransition(async () => {
      const result = await updateLabel(id, editName, editColor);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      setEditingId(null);
      push("Label updated");
    });
  }

  function remove(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      window.setTimeout(
        () => setConfirmingId((current) => (current === id ? null : current)),
        3000
      );
      return;
    }

    startTransition(async () => {
      const result = await deleteLabel(id);
      setConfirmingId(null);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      push("Label deleted");
    });
  }

  return (
    <div className={`glass rounded-xl px-5 py-5 ${pending ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm">
            <Tag size={14} className="text-brand-violet" />
            Labels
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Shared across the workspace. Deleting one removes it from every task.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus size={13} />
            New
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-4 rounded-lg border border-brand-violet/30 bg-brand-violet/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Label name"
              className={field}
            />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3">
            <Swatches value={color} onChange={setColor} />
          </div>
          <button
            type="button"
            onClick={submitNew}
            disabled={pending || !name.trim()}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Create label
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1">
        {labels.length === 0 && !adding && (
          <p className="py-4 text-xs text-muted-foreground/70">
            No labels yet. Create one and it becomes available on every task.
          </p>
        )}

        {labels.map((label) =>
          editingId === label.id ? (
            <div
              key={label.id}
              className="rounded-lg border border-brand-violet/30 bg-brand-violet/5 px-3 py-3"
            >
              <input
                value={editName}
                autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitEdit(label.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className={field}
              />
              <div className="mt-3">
                <Swatches value={editColor} onChange={setEditColor} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => submitEdit(label.id)}
                  disabled={pending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={label.id}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/40"
            >
              <span
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  color: label.color,
                  backgroundColor: `color-mix(in oklab, ${label.color} 18%, transparent)`,
                }}
              >
                {label.name}
              </span>
              <span className="flex-1 text-[11px] text-muted-foreground">
                {label.taskCount} {label.taskCount === 1 ? "task" : "tasks"}
              </span>

              {label.canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(label.id);
                      setEditName(label.name);
                      setEditColor(label.color);
                    }}
                    className="text-[11px] text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(label.id)}
                    disabled={pending}
                    className={`rounded px-1.5 py-1 text-[10px] transition-all ${
                      confirmingId === label.id
                        ? "bg-destructive/15 text-destructive opacity-100"
                        : "text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    }`}
                  >
                    {confirmingId === label.id ? "Sure?" : <Trash2 size={13} />}
                  </button>
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
