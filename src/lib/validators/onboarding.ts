import { z } from "zod";

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(80),
  jobTitle: z.string().trim().max(80).optional(),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +919876543210")
    .optional()
    .or(z.literal("")),
  timezone: z.string().min(1, "Pick a timezone"),
  workingHoursStart: z.coerce.number().int().min(0).max(23),
  workingHoursEnd: z.coerce.number().int().min(1).max(24),
  workingDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one working day"),
  whatsappOptIn: z.boolean(),
});