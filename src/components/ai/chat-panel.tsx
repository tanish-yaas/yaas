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
                  ? `Applied to ${result.applied} ${result.applied === 1 ? "task" : "tasks"}.`
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
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-violet/15">
              <Sparkles size={20} className="text-brand-violet" />
            </div>
            <div>
              <p className="text-sm">Ask about your workspace</p>
              <p className="mt-1 text-xs text-muted-foreground">
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
                  className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-violet/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 py-2">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-violet/20 px-4 py-2.5 text-sm">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Sparkles size={14} className="mt-1.5 shrink-0 text-brand-violet" />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {m.content}
                    </p>

                    {m.proposals?.map((p, pi) => (
                      <div
                        key={pi}
                        className="mt-3 rounded-xl border border-brand-violet/30 bg-brand-violet/5 px-4 py-3"
                      >
                        <p className="text-xs text-muted-foreground">{p.summary}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => confirm(i, p)}
                            disabled={pending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            <Check size={12} />
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => dismiss(i)}
                            disabled={pending}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <X size={12} />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}

                    {m.appliedNote && (
                      <p className="mt-2 text-xs text-muted-foreground/70">
                        {m.appliedNote}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Sparkles size={14} className="animate-pulse text-brand-violet" />
              Thinking…
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {error && <p className="pb-2 text-xs text-destructive">{error}</p>}

      <div className="glass mt-3 flex items-end gap-2 rounded-xl px-3 py-2.5">
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
          className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
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