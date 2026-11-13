import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import SavedPlace from '@/lib/mongodb/models/SavedPlace';

// DELETE /api/trips/[id]/saved/[savedId] — remove a saved place or tip.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; savedId: string }> }) {
  const { id, savedId } = await params;
  const { user, error } = await ownedTrip(id);
  if (error) return error;
  if (!mongoose.isValidObjectId(savedId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const res = await SavedPlace.deleteOne({ _id: savedId, userId: user._id });
  if (!res.deletedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ removed: savedId });
}
