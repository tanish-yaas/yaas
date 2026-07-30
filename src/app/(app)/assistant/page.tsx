import { ChatPanel } from "@/components/ai/chat-panel";

export default function AssistantPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4">
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