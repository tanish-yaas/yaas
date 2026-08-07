"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Send, Sparkles, Check, X } from "lucide-react";
import { sendChatMessage, applyProposal } from "@/server/actions/ai-chat";
import type { Proposal } from "@/lib/ai/tools";

type Message = {
  role: "user" | "assistant";
  content: string;
  proposals?: Proposal[];
  appliedNote?: string;
};

const SUGGESTIONS = [
  "What's overdue?",
  "How's my week looking?",
  "What's due in the next 3 days?",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setError(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    startTransition(async () => {
      const result = await sendChatMessage(conversationId, history, trimmed);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.text,
          proposals: result.proposals,
        },
      ]);
    });
  }

  function confirm(messageIndex: number, proposal: Proposal) {
    startTransition(async () => {
      const result = await applyProposal(proposal);

      setMessages((prev) =>
        prev.map((m, i) =>
          i === messageIndex
            ? {
                ...m,
                proposals: undefined,
                appliedNote: result.ok
                  ? `Applied to ${result.applied} ${
                      result.applied === 1 ? "task" : "tasks"
                    }.`
                  : result.error,
              }
            : m
        )
      );
    });
  }

  function dismiss(messageIndex: number) {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === messageIndex
          ? { ...m, proposals: undefined, appliedNote: "Dismissed." }
          : m
      )
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="panel min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-violet/25 bg-brand-violet/[0.12]">
              <Sparkles size={19} className="text-brand-violet" />
            </div>
            <div>
              <p className="text-[13px]">Ask about your workspace</p>
              <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-faint">
                It reads your real tasks and calendar, and asks before changing
                anything.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="pill text-[12px]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 py-1">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-xl rounded-br-sm border border-brand-violet/25 bg-brand-violet/[0.14] px-3.5 py-2 text-[13px]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Sparkles
                    size={14}
                    className="mt-1 shrink-0 text-brand-violet"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                      {m.content}
                    </p>

                    {m.proposals?.map((p, pi) => (
                      <div
                        key={pi}
                        className="mt-3 rounded-xl border border-brand-violet/30 bg-brand-violet/[0.07] px-4 py-3 backdrop-blur-sm"
                      >
                        <p className="text-[12px] leading-relaxed text-muted-foreground">
                          {p.summary}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => confirm(i, p)}
                            disabled={pending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            <Check size={12} />
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => dismiss(i)}
                            disabled={pending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,white_10%,transparent)] px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <X size={12} />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}

                    {m.appliedNote && (
                      <p className="mt-2 text-[11px] text-faint">
                        {m.appliedNote}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-2.5 text-[12px] text-faint">
              <Sparkles size={13} className="animate-pulse text-brand-violet" />
              Thinking…
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="shrink-0 pt-2 text-[12px] text-destructive">{error}</p>
      )}

      <div className="input-shell mt-3 shrink-0 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask anything about your work…"
          className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[13px] outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={pending || !input.trim()}
          className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}