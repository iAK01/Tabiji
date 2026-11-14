import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripTask from '@/lib/mongodb/models/TripTask';
import { isTaskDate, isTaskTime, onTripDay, taskOut, TASK_MAX_LENGTH } from '@/lib/itinerary/tasks';

// PATCH { text?, done?, remindAt?, date? } — any of them. `completed: true` is what a
// reminder's Done button sends (public/sw.js), and ticks the task off too.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const body  = await req.json().catch(() => ({}));
  const set:   Record<string, unknown> = {};
  const unset: Record<string, ''>      = {};

  if (body.text !== undefined) {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > TASK_MAX_LENGTH) return NextResponse.json({ error: 'A task needs some text' }, { status: 400 });
    set.text = text;
  }

  const done = body.done ?? (body.completed === true ? true : undefined);
  if (done !== undefined) {
    if (typeof done !== 'boolean') return NextResponse.json({ error: 'Invalid done' }, { status: 400 });
    set.done = done;
    if (done) set.doneAt = new Date(); else unset.doneAt = '';
  }

  if (body.remindAt !== undefined) {
    if (body.remindAt === null) unset.remindAt = '';
    else if (isTaskTime(body.remindAt)) set.remindAt = body.remindAt;
    else return NextResponse.json({ error: 'Invalid reminder time' }, { status: 400 });
  }

  if (body.date !== undefined) {
    if (!isTaskDate(body.date) || !onTripDay(trip, body.date)) {
      return NextResponse.json({ error: 'That day isn’t part of this trip' }, { status: 400 });
    }
    set.date = body.date;
  }

  if (!Object.keys(set).length && !Object.keys(unset).length) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }

  const doc = await TripTask.findOneAndUpdate(
    { _id: taskId, tripId: trip._id },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true },
  ).lean();
  if (!doc) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ task: taskOut(doc) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const { deletedCount } = await TripTask.deleteOne({ _id: taskId, tripId: trip._id });
  if (!deletedCount) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ deleted: taskId });
}
