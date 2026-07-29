"use client";

import { useState, useRef, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createEvent } from "@/server/actions/events";

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-violet";

export function EventComposer({
  tasks,
}: {
  tasks: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createEvent(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus size={14} />
        New event
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="glass w-full rounded-xl px-4 py-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          New event
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <input
            name="title"
            required
            placeholder="Event title"
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Starts</label>
          <input type="datetime-local" name="startAt" required className={field} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Ends</label>
          <input type="datetime-local" name="endAt" required className={field} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Location</label>
          <input name="location" placeholder="Optional" className={field} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Link to task</label>
          <select name="taskId" defaultValue="" className={field}>
            <option value="">None</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="allDay" className="h-3.5 w-3.5 accent-[#7C5CFF]" />
          <span className="text-xs text-muted-foreground">All day</span>
        </label>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}