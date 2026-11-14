import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripTask from '@/lib/mongodb/models/TripTask';
import { isTaskDate, isTaskId, isTaskTime, onTripDay, taskOut, TASK_MAX_LENGTH } from '@/lib/itinerary/tasks';

// POST { _id, date, text, remindAt? } — a task on an itinerary day. The id is made
// on the device, so sending it again (a queued write replayed) adds nothing twice.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, user, error } = await ownedTrip(id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!isTaskId(body._id)) return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
  if (!text || text.length > TASK_MAX_LENGTH) return NextResponse.json({ error: 'A task needs some text' }, { status: 400 });
  if (!isTaskDate(body.date) || !onTripDay(trip, body.date)) {
    return NextResponse.json({ error: 'That day isn’t part of this trip' }, { status: 400 });
  }
  if (body.remindAt != null && !isTaskTime(body.remindAt)) {
    return NextResponse.json({ error: 'Invalid reminder time' }, { status: 400 });
  }

  try {
    const doc = await TripTask.findOneAndUpdate(
      { _id: body._id, tripId: trip._id },
      {
        $setOnInsert: {
          userId: user._id, date: body.date, text, done: false,
          ...(body.remindAt ? { remindAt: body.remindAt } : {}),
        },
      },
      { upsert: true, new: true },
    ).lean();
    return NextResponse.json({ task: taskOut(doc) });
  } catch (err: any) {
    // The id is taken by a task on another trip
    if (err?.code === 11000) return NextResponse.json({ error: 'Task id already in use' }, { status: 409 });
    throw err;
  }
}
