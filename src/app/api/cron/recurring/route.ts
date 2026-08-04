import { NextResponse } from "next/server";
import {
  backfillNextRunAt,
  processRecurringTasks,
} from "@/server/services/recurring";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backfilled = await backfillNextRunAt();
    const result = await processRecurringTasks();

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      backfilled,
      ...result,
    });
  } catch (err) {
    console.error("[cron:recurring]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
