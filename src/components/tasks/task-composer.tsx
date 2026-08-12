"use client";

import { useState, useRef, useTransition } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { createTask } from "@/server/actions/tasks";
import { uploadTaskAttachment } from "@/server/actions/task-detail";
import { useToast } from "@/components/ui/toast";
import { LabelPicker, type LabelOption } from "./label-picker";
import {
  VoiceRecorder,
  uploadVoiceClip,
  type VoiceClip,
} from "./voice-recorder";

type Member = { userId: string; name: string };

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-violet";

export function TaskComposer({
  members,
  currentUserId,
  labels,
  teams,
  storageReady = false,
}: {
  members: Member[];
  currentUserId: string;
  labels: LabelOption[];
  teams: { id: string; name: string }[];
  /** Voice notes need object storage; without it the recorder stays hidden. */
  storageReady?: boolean;
}) {
  const { push } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [labelOptions, setLabelOptions] = useState<LabelOption[]>(labels);
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    for (const id of labelIds) formData.append("labelIds", id);

    startTransition(async () => {
      const result = await createTask(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      // The task is saved by this point. A failed upload is worth telling the
      // user about, but it must not read as though the task itself failed.
      if (clip && result?.taskId) {
        const attached = await uploadVoiceClip(
          result.taskId,
          clip,
          uploadTaskAttachment
        );
        if (!attached.ok) {
          push(
            attached.error ?? "Task added, but the voice note didn't attach",
            "error"
          );
        }
        URL.revokeObjectURL(clip.url);
      }

      formRef.current?.reset();
      setLabelIds([]);
      setClip(null);
      setExpanded(false);
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="glass rounded-xl px-4 py-4"
    >
      <div className="flex items-center gap-3">
        <Plus size={16} className="shrink-0 text-brand-violet" />
        <input
          name="title"
          placeholder="What needs doing?"
          required
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <textarea
              name="description"
              rows={2}
              placeholder="Notes, context, links…"
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Priority</label>
            <select name="priority" defaultValue="MEDIUM" className={field}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Due</label>
            <input type="datetime-local" name="dueAt" className={field} />
          </div>

          {teams.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Team</label>
              <select name="teamId" defaultValue="" className={field}>
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">
              Estimate (minutes)
            </label>
            <input
              type="number"
              name="estimatedMinutes"
              min={0}
              placeholder="60"
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Labels</span>
            <LabelPicker
              value={labelIds}
              options={labelOptions}
              onChange={setLabelIds}
              onCreated={(label) =>
                setLabelOptions((prev) => [...prev, label])
              }
            />
          </div>

          {storageReady && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Voice note</span>
              <VoiceRecorder
                clip={clip}
                onClip={setClip}
                disabled={pending}
                compact
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Assign to</label>
            <div className="flex max-h-24 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-secondary/30 px-2 py-2">
              {members.map((m) => (
                <label
                  key={m.userId}
                  className="flex cursor-pointer items-center gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    name="assigneeIds"
                    value={m.userId}
                    defaultChecked={m.userId === currentUserId}
                    className="h-3.5 w-3.5 accent-[#7C5CFF]"
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}
    </form>
  );
}