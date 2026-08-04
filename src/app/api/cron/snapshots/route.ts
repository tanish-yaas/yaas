import { NextResponse } from "next/server";
import { isDayKey } from "@/lib/dates";
import {
  buildSnapshotsForDay,
  previousDayKey,
} from "@/server/services/snapshots";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?date=YYYY-MM-DD backfills a specific day; otherwise yesterday in IST.
  const requested = new URL(request.url).searchParams.get("date");
  const dayKey = isDayKey(requested) ? requested : previousDayKey();

  try {
    const result = await buildSnapshotsForDay(dayKey);

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("[cron:snapshots]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
