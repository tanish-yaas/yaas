"use client";

import { useState, useTransition } from "react";
import { Building2, LogOut } from "lucide-react";
import { updateWorkspace, leaveWorkspace } from "@/server/actions/workspaces";
import { toHandle } from "@/server/workspace/paths";
import { useToast } from "@/components/ui/toast";
import { SettingsPanel } from "./settings-panel";

const field =
  "w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-[13px] outline-none transition-colors focus:border-brand-violet";

export function WorkspaceSettings({
  name: initialName,
  handle: initialHandle,
  allowRequests: initialAllowRequests,
  memberCount,
  canEdit,
  canLeave,
  ownerName,
}: {
  name: string;
  handle: string;
  allowRequests: boolean;
  memberCount: number;
  /** org.settings. A Member sees the same panel read-only. */
  canEdit: boolean;
  /** False for the owner, who has to hand the workspace over first. */
  canLeave: boolean;
  ownerName: string;
}) {
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState(initialHandle);
  const [allowRequests, setAllowRequests] = useState(initialAllowRequests);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  const dirty =
    name !== initialName ||
    handle !== initialHandle ||
    allowRequests !== initialAllowRequests;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await updateWorkspace(formData);
      // A handle change redirects out of this page, so a result only comes
      // back when we stayed put.
      if (result && !result.ok) {
        push(result.error, "error");
        return;
      }
      push("Workspace updated");
    });
  }

  function leave() {
    startTransition(async () => {
      const result = await leaveWorkspace();
      if (result && !result.ok) push(result.error, "error");
    });
  }

  return (
    <SettingsPanel
      title="Workspace"
      icon={<Building2 size={12} />}
      description={
        canEdit
          ? "The name your team sees, and the handle in every link they open."
          : `${memberCount} ${memberCount === 1 ? "member" : "members"} · owned by ${ownerName}`
      }
    >
      {canEdit ? (
        <form action={save} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-faint">Name</span>
            <input
              name="name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-faint">Handle</span>
            <div className="flex items-center overflow-hidden rounded-lg border border-border bg-secondary/60 focus-within:border-brand-violet">
              <span className="shrink-0 py-2 pl-3 text-[13px] text-faint">/w/</span>
              <input
                name="handle"
                value={handle}
                maxLength={40}
                onChange={(e) => setHandle(toHandle(e.target.value))}
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-[13px] outline-none"
              />
            </div>
            {handle !== initialHandle && (
              <span className="text-[11px] leading-relaxed text-faint">
                Changing this breaks links your team has already bookmarked or
                pasted into chat. The old handle is not kept.
              </span>
            )}
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-3">
            <input
              type="checkbox"
              name="allowRequests"
              checked={allowRequests}
              onChange={(e) => setAllowRequests(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#7C5CFF]"
            />
            <span className="text-[12px] leading-relaxed text-muted-foreground">
              Let people who know the handle{" "}
              <span className="text-foreground">{handle}</span> ask to join.
              Requests wait for an admin on the Members page. With this off, an
              invite code is the only way in — and the handle gives nothing
              away.
            </span>
          </label>

          <button
            type="submit"
            disabled={pending || !dirty}
            className="inline-flex h-9 items-center justify-center self-start rounded-lg bg-primary px-4 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[13px]">{initialName}</p>
          <p className="text-[12px] text-faint">/w/{initialHandle}</p>
        </div>
      )}

      {canLeave && (
        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            onClick={leave}
            disabled={pending}
            className="hover-action hover-action--danger flex items-center gap-1.5 text-[12px] opacity-100"
          >
            <LogOut size={12} />
            Leave {initialName}
          </button>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            Your tasks, events and notes stay with the workspace. You&apos;ll
            need a new invite to come back.
          </p>
        </div>
      )}
    </SettingsPanel>
  );
}
