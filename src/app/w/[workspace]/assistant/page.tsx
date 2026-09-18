import { ChatPanel } from "@/components/ai/chat-panel";

export default function AssistantPage() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <header className="mb-4 shrink-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Assistant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reads your workspace. Asks before changing anything.
        </p>
      </header>
      <ChatPanel />
    </div>
  );
}