"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Plus, X } from "lucide-react";
import { createInvite, revokeInvite } from "@/server/actions/invites";
import { useToast } from "@/components/ui/toast";

export type InviteRow = {
  id: string;
  code: string;
  label: string | null;
  roleName: string;
  email: string | null;
  maxUses: number | null;
  useCount: number;
  expiresLabel: string | null;
  expired: boolean;
  spent: boolean;
};

const ROLES = [
  { key: "MEMBER", label: "Member" },
  { key: "MANAGER", label: "Manager" },
  { key: "ADMIN", label: "Admin" },
];

const EXPIRY = [
  { key: "7d", label: "7 days" },
  { key: "1d", label: "24 hours" },
  { key: "30d", label: "30 days" },
  { key: "never", label: "Never" },
];

const fieldClass =
  "w-full rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-[12px] outline-none transition-colors focus:border-brand-violet";

/**
 * A code is only useful once it is somewhere else — a DM, an email, a message
 * in a group chat. So the copy button is the primary control and the row is
 * built around it, rather than the code being a monospace detail you have to
 * select by hand.
 */
function CopyButton({ code, joinUrl }: { code: string; joinUrl: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const { push } = useToast();

  async function copy(what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(what === "code" ? code : joinUrl);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard access is refused in some browsers and over plain http.
      // Saying so beats a button that silently does nothing.
      push("Couldn't copy — select the code and copy it by hand", "error");
    }
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => copy("code")}
        title="Copy code"
        className="icon-btn"
      >
        {copied === "code" ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <button
        type="button"
        onClick={() => copy("link")}
        className="hover-action text-[11px]"
      >
        {copied === "link" ? "Copied" : "Copy link"}
      </button>
    </span>
  );
}

export function InviteCodes({
  invites,
  canGrantAdmin,
  joinUrlBase,
}: {
  invites: InviteRow[];
  /** Managers hold member.invite but not member.assign_role. */
  canGrantAdmin: boolean;
  /** Absolute origin, so a copied link works when pasted anywhere. */
  joinUrlBase: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fresh, setFresh] = useState<string | null>(null);
  const router = useRouter();
  const { push } = useToast();

  const roles = canGrantAdmin ? ROLES : ROLES.filter((r) => r.key !== "ADMIN");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createInvite(formData);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      setFresh(result.code);
      setOpen(false);
      push("Invite code ready");
      router.refresh();
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeInvite(id);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      push("Code revoked");
      router.refresh();
    });
  }

  return (
    <section className="panel mt-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
          Invite codes
          <span className="ml-1.5 tabular-nums">{invites.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="hover-action flex items-center gap-1 text-[12px] opacity-100"
        >
          {open ? <X size={12} /> : <Plus size={12} />}
          {open ? "Cancel" : "New code"}
        </button>
      </div>

      {/* Handed straight back after creation. The admin made this to send it to
          someone, and that someone is usually already waiting. */}
      {fresh && (
        <div className="flex items-center gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-4 py-3">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] tracking-[0.06em]">
            {fresh}
          </span>
          <CopyButton
            code={fresh}
            joinUrl={`${joinUrlBase}/welcome/join?code=${encodeURIComponent(fresh)}`}
          />
        </div>
      )}

      {open && (
        <form
          action={submit}
          className="grid grid-cols-2 gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-4"
        >
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[11px] text-faint">What&apos;s it for?</span>
            <input
              name="label"
              maxLength={60}
              placeholder="Design contractors"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">Joins as</span>
            <select name="roleKey" defaultValue="MEMBER" className={fieldClass}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">Expires</span>
            <select name="expiry" defaultValue="7d" className={fieldClass}>
              {EXPIRY.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">Max uses</span>
            <input
              name="maxUses"
              type="number"
              min={1}
              max={500}
              placeholder="Unlimited"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">Lock to an email</span>
            <input
              name="email"
              type="email"
              placeholder="Anyone with the code"
              className={fieldClass}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="col-span-2 mt-1 inline-flex h-9 items-center justify-center rounded-lg bg-primary text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create code"}
          </button>
        </form>
      )}

      {invites.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">No invite codes yet</p>
          <p className="mt-1 text-[12px] text-faint">
            A code lets someone in immediately, with the role you pick.
          </p>
        </div>
      ) : (
        <ul>
          {invites.map((invite, i) => {
            const dead = invite.expired || invite.spent;

            return (
              <li
                key={invite.id}
                className={`row gap-3 ${i > 0 ? "border-t border-[color-mix(in_oklab,white_6%,transparent)]" : ""} ${dead ? "opacity-50" : ""}`}
              >
                <span className="shrink-0 font-mono text-[12px] tracking-[0.05em]">
                  {invite.code}
                </span>

                <span className="min-w-0 flex-1 truncate text-[12px] text-faint">
                  {invite.label ?? invite.email ?? "Anyone with the code"}
                </span>

                <span className="chip chip-accent shrink-0">{invite.roleName}</span>

                <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-faint">
                  {invite.useCount}
                  {invite.maxUses !== null ? `/${invite.maxUses}` : ""} used
                  {invite.expiresLabel ? ` · ${invite.expiresLabel}` : ""}
                </span>

                {!dead && (
                  <CopyButton
                    code={invite.code}
                    joinUrl={`${joinUrlBase}/welcome/join?code=${encodeURIComponent(invite.code)}`}
                  />
                )}

                <button
                  type="button"
                  onClick={() => revoke(invite.id)}
                  disabled={pending}
                  className="hover-action hover-action--danger shrink-0 text-[12px]"
                >
                  Revoke
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
