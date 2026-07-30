import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { AI_CONFIG } from "@/config/ai";
import { buildTools, type ChatContext, type Proposal } from "@/lib/ai/tools";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatReply = {
  text: string;
  proposals: Proposal[];
};

function systemPrompt(ctx: ChatContext, nowLabel: string): string {
  return [
    "You are the assistant inside YAAS, a team task and calendar workspace.",
    "",
    `Current time: ${nowLabel} (${ctx.timezone}).`,
    "",
    "Always call a tool before stating anything about tasks, deadlines or",
    "events. Never guess at counts or dates.",
    "",
    "To create or change anything, call a propose tool. Never claim something",
    "has been done — proposals require the user to confirm, and you do not",
    "see that confirmation. Say what you have proposed, not what you did.",
    "",
    "Be brief. Two or three sentences unless asked for detail. Format lists",
    "as short plain lines, never markdown tables.",
  ].join("\n");
}

export async function runChat(params: {
  ctx: ChatContext;
  history: ChatTurn[];
  message: string;
}): Promise<{ ok: true; reply: ChatReply } | { ok: false; error: string }> {
  const nowLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: params.ctx.timezone,
  }).format(new Date());

  try {
    const result = await generateText({
      model: google(AI_CONFIG.model),
      system: systemPrompt(params.ctx, nowLabel),
      tools: buildTools(params.ctx),
      stopWhen: stepCountIs(6),
      messages: [
        ...params.history.map((t) => ({
          role: t.role,
          content: t.content,
        })),
        { role: "user" as const, content: params.message },
      ],
    });

    const proposals: Proposal[] = [];

    for (const step of result.steps) {
      for (const toolResult of step.toolResults ?? []) {
        const output = toolResult.output as { proposal?: Proposal } | undefined;
        if (output?.proposal) proposals.push(output.proposal);
      }
    }

    return {
      ok: true,
      reply: {
        text: result.text || "Done — see the proposal below.",
        proposals,
      },
    };
  } catch (err) {
    console.error("[ai-chat]", err);
    const message = err instanceof Error ? err.message : "";
    const rateLimited = /429|quota|rate/i.test(message);
    return {
      ok: false,
      error: rateLimited
        ? "Free tier rate limit hit. Wait a minute and try again."
        : "Something went wrong. Try rephrasing.",
    };
  }
}