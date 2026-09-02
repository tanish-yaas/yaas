"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Users } from "lucide-react";
import { RANGE_DAYS, type AnalyticsScope } from "./types";

export type ScopeMember = { userId: string; name: string };

function href(params: {
  scope?: string;
  user?: string;
  range: number;
}): string {
  const search = new URLSearchParams();
  if (params.scope) search.set("scope", params.scope);
  if (params.user) search.set("user", params.user);
  search.set("range", String(params.range));
  return `/analytics?${search.toString()}`;
}

function Segment({
  active,
  href: to,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      prefetch
      data-on={active}
      className="pill pill-sm whitespace-nowrap"
    >
      {children}
    </Link>
  );
}

/**
 * One filter row, above everything it scopes. Every chart on the page reads
 * the same slice — per-card filters would let two cards disagree about what
 * they are showing.
 *
 * The scope lives in the URL rather than component state, so a view is a link:
 * "here is what my team looks like this quarter" can be pasted to someone who
 * also has permission to see it.
 */
export function ScopeBar({
  scope,
  rangeDays,
  members,
  canSeeOthers,
  selfId,
}: {
  scope: AnalyticsScope;
  rangeDays: number;
  members: ScopeMember[];
  canSeeOthers: boolean;
  selfId: string;
}) {
  const router = useRouter();
  const selectedUser = scope.kind === "user" ? scope.userId : "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      {canSeeOthers && (
        <div className="flex items-center gap-2">
          <Users size={13} className="shrink-0 text-faint" />
          <div className="flex items-center gap-1">
            <Segment
              active={scope.kind === "self"}
              href={href({ range: rangeDays })}
            >
              Just me
            </Segment>
            <Segment
              active={scope.kind === "everyone"}
              href={href({ scope: "everyone", range: rangeDays })}
            >
              Everyone
            </Segment>
          </div>

          <select
            aria-label="Analytics for one person"
            value={selectedUser}
            onChange={(e) => {
              const userId = e.target.value;
              router.push(
                userId
                  ? href({ scope: "user", user: userId, range: rangeDays })
                  : href({ range: rangeDays })
              );
            }}
            className="field field-auto py-1 text-[12px]"
          >
            <option value="">One person…</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
                {member.userId === selfId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <CalendarRange size={13} className="shrink-0 text-faint" />
        <div className="flex items-center gap-1">
          {RANGE_DAYS.map((days) => (
            <Segment
              key={days}
              active={rangeDays === days}
              href={href({
                scope: scope.kind === "self" ? undefined : scope.kind,
                user: scope.kind === "user" ? scope.userId : undefined,
                range: days,
              })}
            >
              {days}d
            </Segment>
          ))}
        </div>
      </div>
    </div>
  );
}
