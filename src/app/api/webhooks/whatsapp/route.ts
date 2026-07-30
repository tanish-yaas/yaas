import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifySignature,
  extractMessages,
  handleInbound,
} from "@/server/services/whatsapp";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const messages = extractMessages(payload);

  for (const message of messages) {
    const existing = await prisma.webhookEvent.findFirst({
      where: { provider: "whatsapp", externalId: message.waMessageId },
    });
    if (existing) continue;

    const event = await prisma.webhookEvent.create({
      data: {
        provider: "whatsapp",
        externalId: message.waMessageId,
        eventType: "message",
        payload: JSON.parse(JSON.stringify(payload)),
        status: "PROCESSING",
      },
    });

    try {
      await handleInbound(message);
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    } catch (err) {
      console.error("[whatsapp:webhook]", err);
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message.slice(0, 500) : "Unknown",
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}