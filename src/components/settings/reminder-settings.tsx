"use client";

import { useState, useTransition } from "react";
import { Bell, MessageCircle } from "lucide-react";
import {
  updateReminderSchedule,
  ensureWeeklySchedule,
} from "@/server/actions/reminder-settings";

export type ScheduleRow = {
  id: string;
  type: string;
  timeOfDay: string;
  channel: string;
  isActive: boolean;
  nextSendAt: string | null;
};

const LABELS: Record<string, string> = {
  MORNING_DIGEST: "Morning briefing",
  EVENING_REVIEW: "Evening summary",
  WEEKLY_REVIEW: "Weekly review",
};

const DESCRIPTIONS: Record<string, string> = {
  MORNING_DIGEST: "What's due today, plus your calendar",
  EVENING_REVIEW: "What you closed and what's left",
  WEEKLY_REVIEW: "Completion rate and carry-over, Fridays",
};

function Row({
  schedule,
  whatsappReady,
}: {
  schedule: ScheduleRow;
  whatsappReady: boolean;
}) {
  const [time, setTime] = useState(schedule.timeOfDay);
  const [channel, setChannel] = useState(schedule.channel);
  const [active, setActive] = useState(schedule.isActive);
  const [pending, startTransition] = useTransition();

  function save(next: Partial<{ time: string; channel: string; active: boolean }>) {
    const payload = {
      timeOfDay: next.time ?? time,
      channel: next.channel ?? channel,
      isActive: next.active ?? active,
    };
    startTransition(async () => {
      await updateReminderSchedule(schedule.id, payload);
    });
  }

  return (
    <div
      className={`rounded-lg border border-border/60 px-4 py-3.5 transition-opacity ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm">{LABELS[schedule.type] ?? schedule.type}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {DESCRIPTIONS[schedule.type] ?? ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !active;
            setActive(next);
            save({ active: next });
          }}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            active ? "bg-brand-violet" : "bg-secondary"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              active ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              save({ time: e.target.value });
            }}
            className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs outline-none focus:border-brand-violet"
          />

          <button
            type="button"
            onClick={() => {
              setChannel("IN_APP");
              save({ channel: "IN_APP" });
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              channel === "IN_APP"
                ? "bg-brand-violet/15 text-brand-violet"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bell size={12} />
            In-app
          </button>

          <button
            type="button"
            disabled={!whatsappReady}
            onClick={() => {
              setChannel("WHATSAPP");
              save({ channel: "WHATSAPP" });
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors disabled:opacity-40 ${
              channel === "WHATSAPP"
                ? "bg-brand-violet/15 text-brand-violet"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle size={12} />
            WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}

export function ReminderSettings({
  schedules,
  whatsappReady,
}: {
  schedules: ScheduleRow[];
  whatsappReady: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const hasWeekly = schedules.some((s) => s.type === "WEEKLY_REVIEW");

  return (
    <div className="glass rounded-xl px-5 py-5">
      <h2 className="text-sm">Reminders</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Delivered in your timezone. In-app always works; WhatsApp needs an open
        conversation.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {schedules.map((s) => (
          <Row key={s.id} schedule={s} whatsappReady={whatsappReady} />
        ))}
      </div>

      {!hasWeekly && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await ensureWeeklySchedule();
            })
          }
          className="mt-3 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Add weekly review
        </button>
      )}

      {!whatsappReady && (
        <p className="mt-3 text-xs text-muted-foreground/60">
          Link WhatsApp above to enable that channel.
        </p>
      )}
    </div>
  );
}