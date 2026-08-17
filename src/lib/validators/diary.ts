import { z } from "zod";
import { APP_CONFIG } from "@/config/app";

export const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "That isn't a day");

export const diaryPointSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().max(APP_CONFIG.diary.maxPointChars),
  /** Set once the point has been pushed to tasks. */
  taskId: z.string().nullable(),
  /** What the parser made of it, kept so the page still reads if the task goes. */
  taskTitle: z.string().max(200).nullable(),
});

export const diaryPointsSchema = z
  .array(diaryPointSchema)
  .max(APP_CONFIG.diary.maxPoints);

export type DiaryPoint = z.infer<typeof diaryPointSchema>;
