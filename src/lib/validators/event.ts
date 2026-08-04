import { z } from "zod";

/**
 * Field-level validation only. Ordering is checked in the action against dates
 * that have been through fromLocalInput — comparing raw form strings would
 * read them as UTC on the server.
 */
export const eventInputSchema = z.object({
  title: z.string().trim().min(1, "Give the event a title").max(200),
  description: z.string().trim().max(5000).optional(),
  location: z.string().trim().max(200).optional(),
  startAt: z.string().min(1, "Pick a start time"),
  endAt: z.string().min(1, "Pick an end time"),
  allDay: z.boolean().optional(),
  taskId: z.string().optional(),
  calendarId: z.string().optional(),
});

export const eventPatchSchema = z.object({
  title: z.string().trim().min(1, "Title can't be empty").max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  location: z.string().trim().max(200).optional(),
  meetingUrl: z.string().trim().max(500).optional(),
  startAt: z.string().min(1).optional(),
  endAt: z.string().min(1).optional(),
  allDay: z.boolean().optional(),
  taskId: z.string().nullable().optional(),
});

export type EventInput = z.infer<typeof eventInputSchema>;
export type EventPatch = z.infer<typeof eventPatchSchema>;
