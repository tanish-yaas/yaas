import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySlackSignature } from "@/lib/slack/provider";
import {
  handleSlackInbound,
  type InboundSlackMessage,
} from "@/server/services/slack";

export const maxDuration = 60;

type SlackEvent = {
  type?: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
};

type SlackEnvelope = {
  type?: string;
  challenge?: string;
  event_id?: string;
  event?: SlackEvent;
};

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (
    !verifySlackSignature(
      rawBody,
      request.headers.get("x-slack-signature"),
      request.headers.get("x-slack-request-timestamp")
    )
  ) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: SlackEnvelope;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // One-time handshake when the Event Subscriptions URL is saved.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const event = payload.event;
  const externalId = payload.event_id;

  const relevant =
    event &&
    externalId &&
    (event.type === "message" || event.type === "app_mention") &&
    // Anything the bot said itself, or any edit/join/leave noise, would
    // otherwise bounce straight back and loop.
    !event.bot_id &&
    !event.subtype &&
    !!event.user &&
    !!event.channel &&
    !!event.ts &&
    !!event.text?.trim();

  if (!relevant) return NextResponse.json({ received: true });

  // Slack retries aggressively on any slow response, so the dedupe has to
  // happen before the work, not after.
  const existing = await prisma.webhookEvent.findFirst({
    where: { provider: "slack", externalId },
  });
  if (existing) return NextResponse.json({ received: true });

  const record = await prisma.webhookEvent.create({
    data: {
      provider: "slack",
      externalId,
      eventType: event.type ?? "message",
      payload: JSON.parse(rawBody),
      status: "PROCESSING",
    },
  });

  const message: InboundSlackMessage = {
    eventId: externalId,
    slackUserId: event.user!,
    channel: event.channel!,
    threadTs: event.thread_ts,
    ts: event.ts!,
    text: event.text!,
  };

  try {
    await handleSlackInbound(message);
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    console.error("[slack:webhook]", err);
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message.slice(0, 500) : "Unknown",
      },
    });
  }

  return NextResponse.json({ received: true });
}
