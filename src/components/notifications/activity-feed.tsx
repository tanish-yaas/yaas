import { Activity } from "lucide-react";

const VERBS: Record<string, string> = {
  "task.created": "created a task",
  "task.created_from_ai": "created a task with AI",
  "task.created_from_assistant": "created a task via the assistant",
  "event.created": "added a calendar event",
};

type Item = {
  id: string;
  action: string;
  entityType: string;
  actorName: string;
  actorImage: string | null;
  metadata: { title?: string } | null;
  when: string;
};

export function ActivityFeed({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-xl py-10 text-center">
        <Activity size={18} className="text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-xl">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0"
        >
          {item.actorImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.actorImage}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] text-muted-foreground">
              {item.actorName.charAt(0)}
            </div>
          )}

          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            <span className="text-foreground">{item.actorName}</span>{" "}
            {VERBS[item.action] ?? item.action.replace(/[._]/g, " ")}
            {item.metadata?.title && (
              <span className="text-foreground"> · {item.metadata.title}</span>
            )}
          </p>

          <span className="shrink-0 text-[10px] text-muted-foreground/50">
            {item.when}
          </span>
        </div>
      ))}
    </div>
  );
}