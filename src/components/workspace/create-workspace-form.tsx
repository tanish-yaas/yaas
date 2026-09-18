"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createWorkspaceAction } from "@/server/actions/workspaces";
import { toHandle } from "@/server/workspace/paths";
import {
  welcomeInputClass,
  welcomeButtonClass,
} from "@/components/workspace/welcome-frame";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={welcomeButtonClass}>
      {pending ? "Creating…" : "Create workspace"}
    </button>
  );
}

export function CreateWorkspaceForm() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  // Once someone edits the handle it stops tracking the name. Without this,
  // typing the name after fixing the handle silently overwrites their choice.
  const [handleTouched, setHandleTouched] = useState(false);

  const effective = handleTouched ? handle : toHandle(name);

  return (
    <form action={createWorkspaceAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
          Workspace name
        </label>
        <input
          id="name"
          name="name"
          required
          autoFocus
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Influencer Marketing"
          className={welcomeInputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="handle" className="text-xs font-medium text-muted-foreground">
          Handle
        </label>
        <div className="flex items-center gap-0 overflow-hidden rounded-lg border border-border bg-secondary/60 focus-within:border-brand-violet">
          <span className="shrink-0 py-2.5 pl-3 text-[13px] text-faint">/w/</span>
          <input
            id="handle"
            name="handle"
            maxLength={40}
            value={effective}
            onChange={(e) => {
              setHandleTouched(true);
              setHandle(toHandle(e.target.value));
            }}
            placeholder="influencer-marketing"
            className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="text-[11px] leading-relaxed text-faint">
          This is in every link your team opens. If it&apos;s taken, we&apos;ll
          add a number.
        </p>
      </div>

      <Submit />
    </form>
  );
}
