// Tasks on an itinerary day: things to get done and tick off that don't need a
// time block ("close all the windows", "bins out"). One TripTask document each,
// sent along with the itinerary (GET /api/trips/[id]/itinerary → tasks).
// Shared by the client and the server — nothing here touches the database.

export interface DayTask {
  _id:        string;
  date:       string;           // YYYY-MM-DD — the itinerary day it's on
  text:       string;
  done:       boolean;
  doneAt?:    string | null;
  remindAt?:  string | null;    // HH:MM on its date, wherever you are then; none = no reminder of its own
  createdAt?: string;
}

export const TASK_MAX_LENGTH = 500;

const HHMM   = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD    = /^\d{4}-\d{2}-\d{2}$/;
const TASKID = /^[A-Za-z0-9-]{8,64}$/;

export const isTaskTime = (v: unknown): v is string => typeof v === 'string' && HHMM.test(v);
export const isTaskDate = (v: unknown): v is string => typeof v === 'string' && YMD.test(v);
export const isTaskId   = (v: unknown): v is string => typeof v === 'string' && TASKID.test(v);

const ymd = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10);

/** Whether a date is one of the trip's days — the days the itinerary has. */
export function onTripDay(trip: { startDate?: unknown; endDate?: unknown }, date: string): boolean {
  return !!trip.startDate && !!trip.endDate && ymd(trip.startDate) <= date && date <= ymd(trip.endDate);
}

/**
 * Made on the device, so a task added offline can be ticked, edited or deleted
 * before it has reached the server — the queued writes all name the same task.
 */
export function newTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** A stored task as the client sees it. */
export function taskOut(doc: any): DayTask {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return {
    _id:       String(doc._id),
    date:      String(doc.date),
    text:      String(doc.text ?? ''),
    done:      !!doc.done,
    doneAt:    iso(doc.doneAt),
    remindAt:  isTaskTime(doc.remindAt) ? doc.remindAt : null,
    createdAt: iso(doc.createdAt) ?? undefined,
  };
}

/** In the order they were added, a day at a time. */
export function sortTasks(tasks: DayTask[]): DayTask[] {
  return [...tasks].sort((a, b) =>
    a.date.localeCompare(b.date) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
}

/** "Close the windows · Bins out +2 more" */
export function tasksLine(tasks: Array<{ text: string }>, shown = 3): string {
  const names = tasks.slice(0, shown).map(t => t.text.trim()).join(' · ');
  return tasks.length > shown ? `${names} +${tasks.length - shown} more` : names;
}
