import type { TaskRowData } from "@/components/tasks/task-row";

export const CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type EventItem = {
  id: string;
  title: string;
  description: string;
  location: string;
  meetingUrl: string;
  /** ISO instants — every view re-reads them in IST. */
  startAt: string;
  endAt: string;
  allDay: boolean;
  calendarId: string;
  calendarName: string;
  color: string;
  ownerName: string;
  isOwnCalendar: boolean;
  taskId: string | null;
  taskTitle: string | null;
  attendees: { id: string; name: string; status: string }[];
  canEdit: boolean;
};

/** A task deadline, carried alongside the row data TaskRow already speaks. */
export type TaskItem = {
  id: string;
  dueAt: string;
  dayKey: string;
  row: TaskRowData;
};

export type CalendarShareRow = {
  id: string;
  userId: string;
  name: string;
  accessLevel: string;
};

export type CalendarOption = {
  id: string;
  name: string;
  color: string;
  ownerName: string;
  isOwn: boolean;
  canEdit: boolean;
  canShare: boolean;
  shares: CalendarShareRow[];
};

/** A slot the user clicked in a grid, ready to seed a new event. */
export type DraftSlot = {
  dayKey: string;
  startMinutes: number;
  endMinutes: number;
};
