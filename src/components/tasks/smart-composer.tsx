"use client";

import { useState, useTransition } from "react";
import { Sparkles, X, HelpCircle } from "lucide-react";
import {
  parseTask,
  applyParsedTask,
  discardParsedTask,
} from "@/server/actions/ai-tasks";
import { toLocalInput } from "@/lib/dates";
import { createLabel } from "@/server/actions/labels";
import { theme } from "@/config/theme";
import { useToast } from "@/components/ui/toast";
import { LabelPicker, type LabelOption } from "./label-picker";
import type { ParsedTask } from "@/lib/ai/schemas";

type Member = { userId: string; name: string };

export function SmartComposer({
  members,
  currentUserId,
  labels,
}: {
  members: Member[];
  currentUserId: string;
  labels: LabelOption[];
}) {
  const { push } = useToast();
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<{ parsed: ParsedTask; id: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const [estimate, setEstimate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [labelOptions, setLabelOptions] = useState<LabelOption[]>(labels);
  const [suggestedLabels, setSuggestedLabels] = useState<string[]>([]);

  function handleParse() {
    if (!input.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await parseTask(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const p = result.parsed;
      setDraft({ parsed: p, id: result.parsedTaskId });
      setTitle(p.title);
      setDescription(p.description ?? "");
      setPriority(p.priority);
      setDueAt(p.dueAt ? toLocalInput(new Date(p.dueAt)) : "");
      setEstimate(p.estimatedMinutes ? String(p.estimatedMinutes) : "");
      setSubtasks(p.subtasks);

      const matched = members
        .filter((m) =>
          p.assigneeNames.some(
            (n) =>
              m.name.toLowerCase().includes(n.toLowerCase()) ||
              n.toLowerCase().includes(m.name.split(" ")[0].toLowerCase())
          )
        )
        .map((m) => m.userId);

      setAssignees(matched.length > 0 ? matched : [currentUserId]);

      // The parser hands back label names; match them to what already exists
      // and offer the rest as one-click creations.
      const known: string[] = [];
      const unknown: string[] = [];

      for (const name of p.labels) {
        const hit = labelOptions.find(
          (l) => l.name.toLowerCase() === name.trim().toLowerCase()
        );
        if (hit) known.push(hit.id);
        else if (name.trim()) unknown.push(name.trim());
      }

      setLabelIds(known);
      setSuggestedLabels(unknown);
    });
  }

  function createSuggested(name: string) {
    startTransition(async () => {
      const color =
        theme.labelPalette[labelOptions.length % theme.labelPalette.length];
      const result = await createLabel(name, color);

      if (!result.ok) {
        push(result.error, "error");
        return;
      }

      setLabelOptions((prev) => [...prev, { id: result.id, name, color }]);
      setLabelIds((prev) => [...prev, result.id]);
      setSuggestedLabels((prev) => prev.filter((n) => n !== name));
    });
  }

  function handleApply() {
    if (!draft) return;
    setError(null);

    startTransition(async () => {
      const result = await applyParsedTask(draft.id, {
        title,
        description,
        priority,
        dueAt,
        estimatedMinutes: estimate,
        assigneeIds: assignees,
        subtasks,
        labelIds,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      setDraft(null);
      setInput("");
      setLabelIds([]);
      setSuggestedLabels([]);
    });
  }

  function handleDiscard() {
    if (!draft) return;
    const id = draft.id;
    setDraft(null);
    startTransition(async () => {
      await discardParsedTask(id);
    });
  }

  if (!draft) {
    return (
      <div>
        <div className="input-shell">
          <Sparkles size={15} className="mt-2 shrink-0 text-brand-violet" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse();
            }}
            rows={2}
            placeholder="Call Aman today at 1pm about the Q3 deck"
            className="flex-1 resize-none bg-transparent py-1.5 text-[13px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={pending || !input.trim()}
            className="mt-0.5 shrink-0 rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Reading…" : "Add"}
          </button>
        </div>

        {error && (
          <p className="mt-2 px-1 text-[12px] text-destructive">{error}</p>
        )}
        <p className="mt-2 px-1 text-[11px] text-faint">
          Write it however you&apos;d say it — we&apos;ll sort out the details.
          ⌘/Ctrl + Enter to add.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-ghost px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-violet" />
          <span className="text-[13px]">Check this looks right</span>
          <span className="chip border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] text-faint">
            {Math.round(draft.parsed.confidence * 100)}% sure
          </span>
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="rounded p-1 text-faint transition-colors hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      {draft.parsed.clarifyingQuestion && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-violet/30 bg-brand-violet/[0.08] px-3 py-2.5">
          <HelpCircle size={14} className="mt-0.5 shrink-0 text-brand-violet" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {draft.parsed.clarifyingQuestion}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[11px] text-faint">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[11px] text-faint">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="field resize-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] text-faint">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="field"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] text-faint">Due</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] text-faint">
            Estimate (minutes)
          </label>
          <input
            type="number"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] text-faint">
            Assign to
          </label>
          <div className="flex max-h-20 flex-col gap-1 overflow-y-auto rounded-lg border border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_4%,transparent)] px-2.5 py-2">
            {members.map((m) => (
              <label
                key={m.userId}
                className="flex cursor-pointer items-center gap-2 text-[12px]"
              >
                <input
                  type="checkbox"
                  checked={assignees.includes(m.userId)}
                  onChange={(e) =>
                    setAssignees((prev) =>
                      e.target.checked
                        ? [...prev, m.userId]
                        : prev.filter((id) => id !== m.userId)
                    )
                  }
                  className="h-3.5 w-3.5 accent-[#7C5CFF]"
                />
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[11px] text-faint">Labels</label>
          <LabelPicker
            value={labelIds}
            options={labelOptions}
            onChange={setLabelIds}
            onCreated={(label) => setLabelOptions((prev) => [...prev, label])}
          />

          {suggestedLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.1em] text-faint">
                Suggested
              </span>
              {suggestedLabels.map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={pending}
                  onClick={() => createSuggested(name)}
                  title="Create this label and attach it"
                  className="chip border-dashed border-brand-violet/45 bg-brand-violet/[0.08] text-brand-violet transition-colors hover:bg-brand-violet/[0.16] disabled:opacity-50"
                >
                  + {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11px] text-faint">
              Subtasks detected
            </label>
            <div className="flex flex-col gap-1.5">
              {subtasks.map((sub, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={sub}
                    onChange={(e) =>
                      setSubtasks((prev) =>
                        prev.map((s, idx) => (idx === i ? e.target.value : s))
                      )
                    }
                    className="field"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSubtasks((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="shrink-0 rounded p-1 text-faint transition-colors hover:text-destructive"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleApply}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={pending}
          className="text-[12px] text-faint transition-colors hover:text-foreground"
        >
          Start over
        </button>
      </div>
    </div>
  );
}