import { NextResponse } from "next/server";
import { processDueReminders, backfillNextSendAt } from "@/server/services/reminders";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backfilled = await backfillNextSendAt();
    const result = await processDueReminders();

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      backfilled,
      ...result,
    });
  } catch (err) {
    console.error("[cron:reminders]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}