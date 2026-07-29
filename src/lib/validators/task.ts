import { z } from "zod";

export const TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
  "CANCELLED",
] as const;

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  priority: z.enum(TASK_PRIORITIES),
  dueAt: z.string().optional().or(z.literal("")),
  estimatedMinutes: z.coerce.number().int().min(0).max(10000).optional(),
  assigneeIds: z.array(z.string().min(1)),
});

export const statusSchema = z.enum(TASK_STATUSES);