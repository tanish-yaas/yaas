"use client";

import { useState, useTransition } from "react";
import { Bell, MessageCircle, Hash } from "lucide-react";
import {
  updateReminderSchedule,
  ensureWeeklySchedule,
} from "@/server/actions/reminder-settings";
import { SettingsPanel } from "./settings-panel";

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
  slackReady,
}: {
  schedule: ScheduleRow;
  whatsappReady: boolean;
  slackReady: boolean;
}) {
  const [time, setTime] = useState(schedule.timeOfDay);
  const [channel, setChannel] = useState(schedule.channel);
  const [active, setActive] = useState(schedule.isActive);
  const [pending, startTransition] = useTransition();

  function save(
    next: Partial<{ time: string; channel: string; active: boolean }>
  ) {
    const payload = {
      timeOfDay: next.time ?? time,
      channel: next.channel ?? channel,
      isActive: next.active ?? active,
    };
    startTransition(async () => {
      await updateReminderSchedule(schedule.id, payload);
    });
  }

  const channels = [
    { key: "IN_APP", label: "In-app", icon: <Bell size={12} />, enabled: true },
    {
      key: "SLACK",
      label: "Slack",
      icon: <Hash size={12} />,
      enabled: slackReady,
    },
    {
      key: "WHATSAPP",
      label: "WhatsApp",
      icon: <MessageCircle size={12} />,
      enabled: whatsappReady,
    },
  ];

  return (
    <div
      className={`px-4 py-3.5 transition-opacity ${pending ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px]">{LABELS[schedule.type] ?? schedule.type}</p>
          <p className="mt-0.5 text-[12px] text-faint">
            {DESCRIPTIONS[schedule.type] ?? ""}
          </p>
        </div>
        <button
          type="button"
          data-on={active}
          aria-label={LABELS[schedule.type] ?? schedule.type}
          onClick={() => {
            const next = !active;
            setActive(next);
            save({ active: next });
          }}
          className="switch mt-0.5"
        />
      </div>

      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              save({ time: e.target.value });
            }}
            className="field field-auto"
          />

          {channels.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={!c.enabled}
              data-on={channel === c.key}
              onClick={() => {
                setChannel(c.key);
                save({ channel: c.key });
              }}
              className={
                channel === c.key
                  ? "pill pill-sm disabled:opacity-35"
                  : "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-faint transition-colors hover:text-foreground disabled:opacity-35"
              }
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReminderSettings({
  schedules,
  whatsappReady,
  slackReady,
}: {
  schedules: ScheduleRow[];
  whatsappReady: boolean;
  slackReady: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const hasWeekly = schedules.some((s) => s.type === "WEEKLY_REVIEW");

  return (
    <SettingsPanel
      title="Reminders"
      description="Delivered in India Standard Time. Slack works for anyone in the workspace with no setup."
    >
      <div className="list">
        {schedules.map((s) => (
          <Row
            key={s.id}
            schedule={s}
            whatsappReady={whatsappReady}
            slackReady={slackReady}
          />
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
          className="pill pill-sm mt-3 disabled:opacity-50"
        >
          Add weekly review
        </button>
      )}
    </SettingsPanel>
  );
}