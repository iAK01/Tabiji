// Saving day tasks (lib/itinerary/tasks.ts) — sent now, or queued offline with the
// change already in the saved itinerary, so it still shows after reopening a tab.
// Each resolves once saved or queued and throws otherwise: the caller undoes the
// change on screen and says so (reportSaveFailure).

import { sendOrQueue, type SavedDataUpdates } from '@/lib/offline/writes';
import { readSaved } from '@/lib/offline/saveErrors';
import type { DayTask } from './tasks';

type TaskFields = Partial<Pick<DayTask, 'text' | 'done' | 'remindAt' | 'date'>>;

// The trip's whole task list after the change, written into the saved itinerary
const savedTasks = (tripId: string, next: DayTask[]): SavedDataUpdates => ({
  [`/api/trips/${tripId}/itinerary`]: saved => saved && { ...saved, tasks: next },
});

async function settle(res: Response | null) {
  if (res) await readSaved(res);
}

export async function sendNewTask(tripId: string, task: DayTask, next: DayTask[]) {
  const body = { _id: task._id, date: task.date, text: task.text, remindAt: task.remindAt ?? null };
  await settle(await sendOrQueue(
    { type: 'ADD_TASK', tripId, payload: body },
    () => fetch(`/api/trips/${tripId}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    savedTasks(tripId, next),
  ));
}

export async function sendTaskChange(tripId: string, task: DayTask, fields: TaskFields, next: DayTask[]) {
  await settle(await sendOrQueue(
    { type: 'UPDATE_TASK', tripId, payload: { taskId: task._id, name: task.text, ...fields } },
    () => fetch(`/api/trips/${tripId}/tasks/${task._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    }),
    savedTasks(tripId, next),
  ));
}

export async function sendTaskDelete(tripId: string, task: DayTask, next: DayTask[]) {
  const res = await sendOrQueue(
    { type: 'DELETE_TASK', tripId, payload: { taskId: task._id, name: task.text } },
    () => fetch(`/api/trips/${tripId}/tasks/${task._id}`, { method: 'DELETE' }),
    savedTasks(tripId, next),
  );
  // Already deleted (on another device) is deleted
  if (res?.status !== 404) await settle(res);
}

/** A task with `fields` changed, as it'll be saved. */
export function changedTask(task: DayTask, fields: TaskFields): DayTask {
  const out = { ...task, ...fields };
  if (fields.done !== undefined) out.doneAt = fields.done ? new Date().toISOString() : null;
  return out;
}
