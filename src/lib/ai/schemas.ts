import { z } from "zod";

export const parsedTaskSchema = z.object({
  title: z.string().describe("Short imperative task title, under 80 characters"),
  description: z
    .string()
    .nullable()
    .describe("Extra context worth keeping, or null if the input adds nothing"),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .describe("URGENT only for explicit emergencies or same-day hard deadlines"),
  dueAt: z
    .string()
    .nullable()
    .describe("ISO 8601 datetime, or null if no deadline is implied"),
  estimatedMinutes: z
    .number()
    .nullable()
    .describe("Estimated effort in minutes if stated or clearly implied"),
  assigneeNames: z
    .array(z.string())
    .describe("Names of people mentioned as doing the work. Empty if only the speaker."),
  labels: z.array(z.string()).describe("Up to 3 short topical labels"),
  subtasks: z
    .array(z.string())
    .describe("Distinct steps if the input describes several, otherwise empty"),
  roadblock: z
    .string()
    .nullable()
    .describe("Anything stated as blocking progress"),
  riskLevel: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  clarifyingQuestion: z
    .string()
    .nullable()
    .describe("One question only if something essential is genuinely ambiguous"),
  confidence: z.number().min(0).max(1).describe("Confidence in this parse"),
});

export type ParsedTask = z.infer<typeof parsedTaskSchema>;