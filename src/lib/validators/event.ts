import { z } from "zod";

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Give the event a title").max(200),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    startAt: z.string().min(1, "Pick a start time"),
    endAt: z.string().min(1, "Pick an end time"),
    allDay: z.boolean(),
    taskId: z.string().optional().or(z.literal("")),
  })
  .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
    message: "End time must be after the start time",
    path: ["endAt"],
  });