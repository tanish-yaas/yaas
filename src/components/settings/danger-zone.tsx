"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Trash2, UserX } from "lucide-react";
import { deleteWorkspace } from "@/server/actions/workspaces";
import { deleteAccount } from "@/server/actions/account";
import {
  DELETE_ACCOUNT_PHRASE,
  DELETE_WORKSPACE_PHRASE,
} from "@/server/workspace/confirm";
import { DANGER, DangerDialog } from "./danger-dialog";

export type WorkspaceDeletion = {
  name: string;
  taskCount: number;
  eventCount: number;
  fileCount: number;
  /** Active members besides the owner, who lose their seat with it. */
  otherMemberCount: number;
};

export type AccountDeletion = {
  email: string;
  /** Workspaces you own alone — deleted with the account. */
  soloOwned: { name: string; slug: string }[];
  /** Workspaces you own that others are in — these block deletion. */
  sharedOwned: { name: string; slug: string; otherMembers: number }[];
  /** Workspaces you are only a member of — your seat goes, your work stays. */
  memberOf: { name: string; slug: string }[];
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function names(list: { name: string }[]) {
  if (list.length === 1) return list[0].name;
  return `${list.slice(0, -1).map((w) => w.name).join(", ")} and ${list[list.length - 1].name}`;
}

function Row({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-faint">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function DangerButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-[12px] font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--status-red)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      style={{
        borderColor: `color-mix(in oklab, ${DANGER} 55%, transparent)`,
        color: `color-mix(in oklab, ${DANGER} 80%, white)`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * The end of Settings: the two things that cannot be taken back.
 *
 * Deleting the workspace is the owner's alone; deleting your account is
 * everyone's. Both open the same two-step dialog — see DangerDialog — and both
 * are checked again on the server against what was typed.
 */
export function DangerZone({
  workspace,
  account,
}: {
  /** Only for the workspace's owner; nobody else may delete it. */
  workspace: WorkspaceDeletion | null;
  account: AccountDeletion;
}) {
  const [open, setOpen] = useState<"workspace" | "account" | null>(null);

  const blocked = account.sharedOwned.length > 0;
  const blockedPlural = account.sharedOwned.length > 1;

  const workspaceConsequences = workspace
    ? [
        workspace.taskCount > 0 &&
          `${plural(workspace.taskCount, "task", "tasks")}, with their subtasks, comments and history`,
        workspace.eventCount > 0 &&
          plural(workspace.eventCount, "calendar event", "calendar events"),
        workspace.fileCount > 0 &&
          `${plural(workspace.fileCount, "file", "files")} and voice notes attached to tasks`,
        "Every diary page, label, team, reminder and suggestion in it",
        workspace.otherMemberCount > 0 &&
          `${plural(workspace.otherMemberCount, "other member loses", "other members lose")} access. Their other workspaces aren't touched`,
      ].filter(Boolean)
    : [];

  const accountConsequences = [
    account.soloOwned.length > 0 &&
      `${names(account.soloOwned)} ${account.soloOwned.length > 1 ? "are" : "is"} deleted with everything in ${account.soloOwned.length > 1 ? "them" : "it"}, where you are the only member`,
    account.memberOf.length > 0 &&
      `You leave ${names(account.memberOf)}. The tasks, events and recurring items you made there stay with the workspace; your comments are removed`,
    "Your profile, diary pages, reminders, notifications and assistant history are deleted",
    "Signing in again would start a completely new account",
  ].filter(Boolean);

  return (
    <section
      className="panel overflow-hidden"
      style={{ borderColor: `color-mix(in oklab, ${DANGER} 32%, transparent)` }}
    >
      <div className="flex items-center gap-2 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
        <h2
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em]"
          style={{ color: `color-mix(in oklab, ${DANGER} 75%, white)` }}
        >
          <AlertTriangle size={12} />
          Danger zone
        </h2>
      </div>

      {workspace && (
        <Row
          title="Delete this workspace"
          description={`Permanently removes ${workspace.name}, with every task, event, file and diary page in it, and every member's access. There is no undo.`}
          action={
            <DangerButton
              icon={<Trash2 size={13} />}
              label="Delete workspace"
              onClick={() => setOpen("workspace")}
            />
          }
        />
      )}

      <div
        className={workspace ? "border-t border-[color-mix(in_oklab,white_7%,transparent)]" : ""}
      >
        <Row
          title="Delete your account"
          description={
            blocked ? (
              <>
                You own{" "}
                {account.sharedOwned.map((w, i) => (
                  <span key={w.slug}>
                    {i > 0 && (i === account.sharedOwned.length - 1 ? " and " : ", ")}
                    <Link
                      href={`/w/${w.slug}/settings`}
                      className="text-foreground underline underline-offset-2"
                    >
                      {w.name}
                    </Link>
                  </span>
                ))}
                {", with other people in "}
                {blockedPlural ? "them" : "it"}
                {". Delete "}
                {blockedPlural ? "them" : "it"}
                {" first, using that workspace's own danger zone, and then this account can go."}
              </>
            ) : (
              "Permanently removes your account and everything personal in it. There is no undo."
            )
          }
          action={
            <DangerButton
              icon={<UserX size={13} />}
              label="Delete account"
              onClick={() => setOpen("account")}
              disabled={blocked}
            />
          }
        />
      </div>

      {open === "workspace" && workspace && (
        <DangerDialog
          title="Delete workspace"
          intro={
            <>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {workspace.name}
              </span>{" "}
              and everything in it, from Nova&apos;s database and file storage.
            </>
          }
          consequences={workspaceConsequences}
          confirmations={[
            {
              name: "confirmName",
              expected: workspace.name,
              label: (
                <>
                  Enter the workspace name{" "}
                  <span className="select-all font-medium text-foreground">
                    {workspace.name}
                  </span>{" "}
                  to continue:
                </>
              ),
            },
            {
              name: "confirmPhrase",
              expected: DELETE_WORKSPACE_PHRASE,
              ignoreCase: true,
              label: (
                <>
                  To verify, type{" "}
                  <span className="select-all font-medium text-foreground">
                    {DELETE_WORKSPACE_PHRASE}
                  </span>{" "}
                  below:
                </>
              ),
            },
          ]}
          submitLabel="Delete this workspace"
          pendingLabel="Deleting…"
          action={deleteWorkspace}
          onClose={() => setOpen(null)}
        />
      )}

      {open === "account" && (
        <DangerDialog
          title="Delete your account"
          intro={
            <>
              This permanently deletes the account for{" "}
              <span className="font-medium text-foreground">
                {account.email}
              </span>
              .
            </>
          }
          consequences={accountConsequences}
          confirmations={[
            {
              name: "confirmEmail",
              expected: account.email,
              ignoreCase: true,
              label: (
                <>
                  Enter your email{" "}
                  <span className="select-all font-medium text-foreground">
                    {account.email}
                  </span>{" "}
                  to continue:
                </>
              ),
            },
            {
              name: "confirmPhrase",
              expected: DELETE_ACCOUNT_PHRASE,
              ignoreCase: true,
              label: (
                <>
                  To verify, type{" "}
                  <span className="select-all font-medium text-foreground">
                    {DELETE_ACCOUNT_PHRASE}
                  </span>{" "}
                  below:
                </>
              ),
            },
          ]}
          submitLabel="Delete my account"
          pendingLabel="Deleting…"
          action={deleteAccount}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
