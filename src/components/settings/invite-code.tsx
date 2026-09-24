"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import {
  createWorkspaceCode,
  resetWorkspaceCode,
} from "@/server/actions/invites";
import { useToast } from "@/components/ui/toast";

export type WorkspaceCode = {
  id: string;
  /** Formatted for reading out: NOVA-7K2P-XM4T-9BRC. */
  code: string;
  useCount: number;
  createdLabel: string | null;
};

/**
 * The workspace's standing invite code, inside the Workspace panel — the one
 * code you hand to a new teammate. Before this the only codes lived on the
 * Members page behind a "New code" form, so a workspace had none at all until
 * an admin went looking.
 *
 * Copying is the whole job, so both copy buttons are always visible rather
 * than revealed on hover the way the Members list does it.
 */
export function InviteCode({
  workspaceName,
  invite,
  joinUrlBase,
  membersHref,
}: {
  workspaceName: string;
  /** Null until someone makes one. */
  invite: WorkspaceCode | null;
  /** Absolute origin, so a copied link works when pasted anywhere. */
  joinUrlBase: string;
  /** Set when the viewer can open the Members page, where the other kinds
      of code — admin, one-person, expiring — are made. */
  membersHref: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { push } = useToast();

  const joinUrl = invite
    ? `${joinUrlBase}/welcome/join?code=${encodeURIComponent(invite.code)}`
    : "";

  async function copy(what: "code" | "link") {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(what === "code" ? invite.code : joinUrl);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Refused in some browsers and over plain http. Saying so beats a
      // button that silently does nothing.
      push("Couldn't copy — select the code and copy it by hand", "error");
    }
  }

  function create() {
    startTransition(async () => {
      const result = await createWorkspaceCode();
      if (!result.ok) push(result.error, "error");
      else push("Invite code ready");
    });
  }

  // Two clicks, because the first one breaks every copy of the code already
  // sent round — the same "Sure?" step deleting a task has.
  function reset() {
    if (!invite) return;
    if (!confirmingReset) {
      setConfirmingReset(true);
      setTimeout(() => setConfirmingReset(false), 4000);
      return;
    }
    setConfirmingReset(false);
    startTransition(async () => {
      const result = await resetWorkspaceCode(invite.id);
      if (!result.ok) push(result.error, "error");
      else push("New code ready — the old one no longer works");
    });
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-faint">
        <UserPlus size={12} />
        Invite code
      </p>
      <p className="mb-3 mt-1.5 text-[12px] leading-relaxed text-faint">
        Anyone with this code joins{" "}
        <span className="text-foreground">{workspaceName}</span> as a Member
        straight away — there&apos;s no approval step. Send it to people
        directly rather than posting it somewhere public.
      </p>
      {invite ? (
        <div className={pending ? "opacity-60 transition-opacity" : ""}>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
            <span className="min-w-0 flex-1 select-all break-all font-mono text-[17px] tracking-[0.08em]">
              {invite.code}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => copy("code")}
                className="pill pill-sm"
              >
                {copied === "code" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "code" ? "Copied" : "Copy code"}
              </button>
              <button
                type="button"
                onClick={() => copy("link")}
                className="pill pill-sm"
                title={joinUrl}
              >
                {copied === "link" ? <Check size={12} /> : <Link2 size={12} />}
                {copied === "link" ? "Copied" : "Copy link"}
              </button>
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-faint">
            <span className="tabular-nums">
              {invite.useCount === 0
                ? "Not used yet"
                : `Used ${invite.useCount} ${invite.useCount === 1 ? "time" : "times"}`}
              {invite.createdLabel && ` · made ${invite.createdLabel}`}
            </span>

            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className={`inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                confirmingReset
                  ? "text-[var(--status-red)]"
                  : "hover:text-foreground"
              }`}
            >
              <RefreshCw size={11} />
              {confirmingReset
                ? "Sure? The current code stops working"
                : "Reset code"}
            </button>

            {membersHref && (
              <Link
                href={membersHref}
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                Admin, one-person and expiring codes
                <ArrowRight size={11} />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[12px] text-muted-foreground">
            This workspace has no invite code yet.
          </p>
          <button
            type="button"
            onClick={create}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={13} />
            {pending ? "Creating…" : "Create invite code"}
          </button>
        </div>
      )}
    </div>
  );
}
