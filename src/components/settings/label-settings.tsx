"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Tag, Trash2, X } from "lucide-react";
import { theme } from "@/config/theme";
import { useToast } from "@/components/ui/toast";
import { createLabel, deleteLabel, updateLabel } from "@/server/actions/labels";
import { SettingsPanel } from "./settings-panel";

export type LabelRow = {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  canManage: boolean;
};

const field = "field";

const accentBox =
  "rounded-xl border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] px-3 py-3";

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
    <SettingsPanel
      title="Labels"
      icon={<Tag size={12} style={{ color: "var(--primary)" }} />}
      dimmed={pending}
      description="Shared across the workspace. Deleting one removes it from every task."
      action={
        !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="pill pill-sm shrink-0"
          >
            <Plus size={12} />
            New
          </button>
        )
      }
    >
      {adding && (
        <div className={accentBox}>
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
              className="shrink-0 rounded p-1 text-faint transition-colors hover:text-foreground"
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
            className="mt-3 inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Create label
          </button>
        </div>
      )}

      <div className={`flex flex-col gap-1 ${adding ? "mt-4" : ""}`}>
        {labels.length === 0 && !adding && (
          <div className="py-6 text-center">
            <p className="text-[13px] text-muted-foreground">No labels yet</p>
            <p className="mt-1 text-[12px] text-faint">
              Create one and it becomes available on every task.
            </p>
          </div>
        )}

        {labels.map((label) =>
          editingId === label.id ? (
            <div key={label.id} className={accentBox}>
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
                  className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-[12px] text-faint transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={label.id}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[color-mix(in_oklab,white_4%,transparent)]"
            >
              <span
                className="label-chip"
                style={{ "--chip-color": label.color } as React.CSSProperties}
              >
                {label.name}
              </span>
              <span className="flex-1 text-[11px] text-faint">
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
                    className="hover-action text-[11px]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(label.id)}
                    disabled={pending}
                    className={`rounded px-1.5 py-1 text-[10px] ${
                      confirmingId === label.id
                        ? "text-[var(--status-red)]"
                        : "hover-action hover-action--danger"
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
    </SettingsPanel>
  );
}
