import { prisma } from "@/lib/prisma";

export async function getVisibleCalendarIds(
  orgId: string,
  userId: string,
  permissions: Set<string>
): Promise<string[]> {
  if (permissions.has("calendar.view_any")) {
    const all = await prisma.calendar.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    return all.map((c) => c.id);
  }

  const owned = await prisma.calendar.findMany({
    where: { organizationId: orgId, ownerId: userId, deletedAt: null },
    select: { id: true },
  });

  const shared = await prisma.calendarShare.findMany({
    where: { organizationId: orgId, userId },
    select: { calendarId: true },
  });

  const ids = new Set([
    ...owned.map((c) => c.id),
    ...shared.map((s) => s.calendarId),
  ]);

  if (permissions.has("calendar.view_team")) {
    const teams = await prisma.teamMember.findMany({
      where: { userId, organizationId: orgId },
      select: { teamId: true },
    });

    if (teams.length > 0) {
      const teamCalendars = await prisma.calendar.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          teamId: { in: teams.map((t) => t.teamId) },
        },
        select: { id: true },
      });
      teamCalendars.forEach((c) => ids.add(c.id));
    }
  }

  return [...ids];
}

export async function getWritableCalendar(orgId: string, userId: string) {
  const existing = await prisma.calendar.findFirst({
    where: {
      organizationId: orgId,
      ownerId: userId,
      type: "PERSONAL",
      deletedAt: null,
    },
    orderBy: { isDefault: "desc" },
  });

  if (existing) return existing;

  return prisma.calendar.create({
    data: {
      organizationId: orgId,
      ownerId: userId,
      name: "My Calendar",
      type: "PERSONAL",
      isDefault: true,
      color: "#7C5CFF",
    },
  });
}

export async function canMutateEvent(
  eventId: string,
  orgId: string,
  userId: string,
  permissions: Set<string>
) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    include: { calendar: { select: { ownerId: true } } },
  });

  if (!event) return null;
  if (permissions.has("calendar.edit_any")) return event;
  if (event.calendar.ownerId === userId || event.createdById === userId) {
    return permissions.has("calendar.edit_own") ? event : null;
  }

  const share = await prisma.calendarShare.findFirst({
    where: {
      calendarId: event.calendarId,
      userId,
      accessLevel: { in: ["EDIT", "FULL_ACCESS"] },
    },
  });

  return share ? event : null;
}