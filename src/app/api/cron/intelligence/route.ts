import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runIntelligence } from "@/server/services/intelligence";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  const results = [];
  for (const org of orgs) {
    try {
      const result = await runIntelligence(org.id);
      results.push({ org: org.name, ...result });
    } catch (err) {
      console.error(`[cron:intelligence] ${org.id}`, err);
      results.push({ org: org.name, error: true });
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}