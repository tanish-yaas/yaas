"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { createEventSchema } from "@/lib/validators/event";
import { getWritableCalendar, canMutateEvent } from "@/server/services/calendar";

export async function createEvent(formData: FormData) {
  const ctx = await requirePermission("calendar.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const parsed = createEventSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    location: formData.get("location") ?? "",
    startAt: formData.get("startAt") ?? "",
    endAt: formData.get("endAt") ?? "",
    allDay: formData.get("allDay") === "on",
    taskId: formData.get("taskId") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;
  const calendar = await getWritableCalendar(orgId, userId);

  let taskId: string | null = null;
  if (d.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: d.taskId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    taskId = task?.id ?? null;
  }

  const event = await prisma.calendarEvent.create({
    data: {
      organizationId: orgId,
      calendarId: calendar.id,
      createdById: userId,
      title: d.title,
      description: d.description || null,
      location: d.location || null,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      allDay: d.allDay,
      timezone: ctx.profile?.timezone ?? "UTC",
      taskId,
    },
  });

  await prisma.activityLog.create({
    data: {
      organizationId: orgId,
      userId,
      action: "event.created",
      entityType: "CalendarEvent",
      entityId: event.id,
      metadata: { title: event.title },
    },
  });

  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteEvent(eventId: string) {
  const ctx = await requirePermission("calendar.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const event = await canMutateEvent(eventId, orgId, userId, ctx.permissions);
  if (!event) return { error: "Not allowed" };

  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/calendar");
  return { ok: true };
}

export async function moveEvent(eventId: string, newStartISO: string) {
  const ctx = await requirePermission("calendar.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const event = await canMutateEvent(eventId, orgId, userId, ctx.permissions);
  if (!event) return { error: "Not allowed" };

  const durationMs = event.endAt.getTime() - event.startAt.getTime();
  const newStart = new Date(newStartISO);

  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      startAt: newStart,
      endAt: new Date(newStart.getTime() + durationMs),
    },
  });

  revalidatePath("/calendar");
  return { ok: true };
}