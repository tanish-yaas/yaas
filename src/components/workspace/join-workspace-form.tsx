"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { joinWorkspaceAction } from "@/server/actions/workspaces";
import {
  welcomeInputClass,
  welcomeButtonClass,
} from "@/components/workspace/welcome-frame";

function Submit({ looksLikeCode }: { looksLikeCode: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={welcomeButtonClass}>
      {pending ? "Checking…" : looksLikeCode ? "Join workspace" : "Ask to join"}
    </button>
  );
}

/** Code characters, in the order they are typed. Mirrors codes.ts. */
const CODE_CHARS = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]+$/;

export function JoinWorkspaceForm({ initialCode }: { initialCode: string }) {
  // Pre-filled from a copied invite link, so the common path is one click.
  // Not auto-submitted: joining a workspace is worth a deliberate press, and a
  // link opened by accident should not enrol anyone.
  const [value, setValue] = useState(initialCode);

  // Purely so the button can say what is about to happen — joining is instant,
  // asking is not, and finding that out after the click is a small betrayal.
  // The server classifies the input again and does not trust this.
  const stripped = value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^NOVA/, "");
  const looksLikeCode = stripped.length === 12 && CODE_CHARS.test(stripped);

  return (
    <form action={joinWorkspaceAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-xs font-medium text-muted-foreground">
          Invite code or workspace handle
        </label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="NOVA-7K2P-XM4T-9BRC"
          className={`${welcomeInputClass} font-mono tracking-[0.06em]`}
        />
        <p className="text-[11px] leading-relaxed text-faint">
          {looksLikeCode
            ? "That's a code, so it'll take you straight in."
            : "A code lets you in immediately. A handle sends a request to that workspace's admins."}
        </p>
      </div>

      <Submit looksLikeCode={looksLikeCode} />
    </form>
  );
}
