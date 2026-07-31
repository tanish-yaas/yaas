import { prisma } from "@/lib/prisma";
import { buildTaskScope } from "@/server/services/tasks";
import { getVisibleCalendarIds } from "@/server/services/calendar";
import { formatIST } from "@/lib/dates";

export type SearchResult = {
  id: string;
  kind: "task" | "event" | "person";
  title: string;
  subtitle: string | null;
  meta: string | null;
  href: string;
};

export async function searchWorkspace(params: {
  query: string;
  orgId: string;
  userId: string;
  permissions: Set<string>;
}): Promise<SearchResult[]> {
  const q = params.query.trim();
  if (q.length < 2) return [];

  const [taskScope, calendarIds] = await Promise.all([
    buildTaskScope(params.orgId, params.userId, params.permissions),
    getVisibleCalendarIds(params.orgId, params.userId, params.permissions),
  ]);

  const [tasks, events, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...taskScope,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ status: "asc" }, { priorityScore: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
      },
    }),

    calendarIds.length > 0
      ? prisma.calendarEvent.findMany({
          where: {
            organizationId: params.orgId,
            calendarId: { in: calendarIds },
            deletedAt: null,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { startAt: "desc" },
          take: 6,
          select: {
            id: true,
            title: true,
            startAt: true,
            location: true,
          },
        })
      : Promise.resolve([]),

    prisma.organizationMember.findMany({
      where: {
        organizationId: params.orgId,
        status: "ACTIVE",
        OR: [
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 5,
      include: {
        user: { select: { name: true, email: true } },
        role: { select: { name: true } },
      },
    }),
  ]);

  const results: SearchResult[] = [];

  for (const t of tasks) {
    results.push({
      id: t.id,
      kind: "task",
      title: t.title,
      subtitle: t.status.replace("_", " ").toLowerCase(),
      meta: formatIST(t.dueAt),
      href: "/tasks",
    });
  }

  for (const e of events) {
    results.push({
      id: e.id,
      kind: "event",
      title: e.title,
      subtitle: e.location || null,
      meta: formatIST(e.startAt),
      href: "/calendar",
    });
  }

  for (const m of members) {
    results.push({
      id: m.id,
      kind: "person",
      title: m.user.name ?? m.user.email ?? "Member",
      subtitle: m.user.email,
      meta: m.role.name,
      href: "/admin/members",
    });
  }

  return results;
}