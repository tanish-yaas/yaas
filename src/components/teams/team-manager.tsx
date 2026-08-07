"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { theme } from "@/config/theme";
import { useToast } from "@/components/ui/toast";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  removeTeamMember,
  renameTeam,
} from "@/server/actions/teams";

export type TeamMemberRow = {
  userId: string;
  name: string;
  role: "LEAD" | "MEMBER";
};

export type TeamRow = {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  members: TeamMemberRow[];
};

export type MemberOption = { userId: string; name: string };

const field = "field";

const separator = "border-t border-[color-mix(in_oklab,white_6%,transparent)]";

export function TeamManager({
  teams,
  members,
  canCreate,
  canManage,
}: {
  teams: TeamRow[];
  members: MemberOption[];
  canCreate: boolean;
  canManage: boolean;
}) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(theme.labelPalette[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(theme.labelPalette[0]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) {
        push(result.error, "error");
        return;
      }
      done?.();
    });
  }

  return (
    <section className="panel mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-faint">
          <Users size={12} />
          Teams
          <span className="tabular-nums">{teams.length}</span>
        </h2>
        {canCreate && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="pill pill-sm"
          >
            <Plus size={12} />
            New team
          </button>
        )}
      </div>

      {adding && (
        <div className="border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-4">
          <div className="flex items-center gap-2">
            <input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Team name"
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

          <div className="mt-3 flex flex-wrap gap-1.5">
            {theme.labelPalette.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
              >
                {color === c && <Check size={11} className="text-white" />}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() =>
              run(
                () => createTeam(name, color),
                () => {
                  setName("");
                  setAdding(false);
                  push("Team created");
                }
              )
            }
            className="mt-3 inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
          >
            Create team
          </button>
        </div>
      )}

      {teams.length === 0 && !adding && (
        <div className="px-6 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">No teams yet</p>
          <p className="mt-1 text-[12px] text-faint">
            Teams control who can see which tasks.
          </p>
        </div>
      )}

      <ul>
        {teams.map((team, index) => (
          <li
            key={team.id}
            className={`px-4 py-3.5 ${index > 0 ? separator : ""}`}
          >
            {editingId === team.id ? (
              <div>
                <input
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  className={field}
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {theme.labelPalette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      aria-label={c}
                      className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                    >
                      {editColor === c && (
                        <Check size={11} className="text-white" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => renameTeam(team.id, editName, editColor),
                        () => setEditingId(null)
                      )
                    }
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
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
              <div className="group">
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <p className="min-w-0 flex-1 truncate text-[13px]">
                    {team.name}
                  </p>
                  <span className="shrink-0 text-[11px] text-faint">
                    {team.members.length}{" "}
                    {team.members.length === 1 ? "member" : "members"} ·{" "}
                    {team.taskCount} {team.taskCount === 1 ? "task" : "tasks"}
                  </span>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(team.id);
                          setEditName(team.name);
                          setEditColor(team.color);
                        }}
                        className="hover-action shrink-0 text-[11px]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (confirmingId !== team.id) {
                            setConfirmingId(team.id);
                            window.setTimeout(
                              () =>
                                setConfirmingId((id) =>
                                  id === team.id ? null : id
                                ),
                              3000
                            );
                            return;
                          }
                          run(
                            () => deleteTeam(team.id),
                            () => {
                              setConfirmingId(null);
                              push("Team deleted");
                            }
                          );
                        }}
                        className={`shrink-0 rounded px-1.5 py-1 text-[10px] ${
                          confirmingId === team.id
                            ? "text-[var(--status-red)]"
                            : "hover-action hover-action--danger"
                        }`}
                      >
                        {confirmingId === team.id ? "Sure?" : <Trash2 size={13} />}
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {team.members.map((member) => (
                    <span
                      key={member.userId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,white_11%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] px-2.5 py-1 text-[11px]"
                    >
                      {member.name}
                      {canManage ? (
                        <select
                          value={member.role}
                          disabled={pending}
                          onChange={(e) =>
                            run(() =>
                              addTeamMember(
                                team.id,
                                member.userId,
                                e.target.value as "LEAD" | "MEMBER"
                              )
                            )
                          }
                          className="bg-transparent text-[10px] uppercase tracking-[0.12em] text-faint outline-none"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="LEAD">Lead</option>
                        </select>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.12em] text-faint">
                          {member.role}
                        </span>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => removeTeamMember(team.id, member.userId))
                          }
                          className="text-faint transition-colors hover:text-[var(--status-red)]"
                          aria-label={`Remove ${member.name}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}

                  {canManage &&
                    (addingTo === team.id ? (
                      <select
                        autoFocus
                        defaultValue=""
                        disabled={pending}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          run(
                            () =>
                              addTeamMember(team.id, e.target.value, "MEMBER"),
                            () => setAddingTo(null)
                          );
                        }}
                        onBlur={() => setAddingTo(null)}
                        className={`${field} w-auto`}
                      >
                        <option value="">Pick someone…</option>
                        {members
                          .filter(
                            (m) =>
                              !team.members.some((tm) => tm.userId === m.userId)
                          )
                          .map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingTo(team.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color-mix(in_oklab,white_16%,transparent)] px-2.5 py-1 text-[11px] text-faint transition-colors hover:border-[var(--primary)] hover:text-foreground"
                      >
                        <UserPlus size={11} />
                        Add
                      </button>
                    ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
