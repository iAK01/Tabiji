import mongoose from 'mongoose';
import Clip from '@/lib/mongodb/models/Clip';
import SavedPlace from '@/lib/mongodb/models/SavedPlace';
import Trip from '@/lib/mongodb/models/Trip';
import { CATEGORY_LABEL, isCategory, type ClipCategory } from '@/lib/clip/categories';
import { json, preflight, unauthorised, userForKey } from '@/lib/clip/auth';

// GET /api/clip/[clipId] — how a clip went, for the clipper to show.

export function OPTIONS() { return preflight(); }

export async function GET(req: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const user = await userForKey(req);
  if (!user) return unauthorised();
  const { clipId } = await params;
  const clip = mongoose.isValidObjectId(clipId) ? await Clip.findOne({ _id: clipId, userId: user._id }).lean() as any : null;
  if (!clip) return json({ error: 'Not found' }, 404);

  const saved = clip.savedIds?.length ? await SavedPlace.find({ _id: { $in: clip.savedIds } }).lean() as any[] : [];
  const tripIds = [...new Set(saved.map(s => s.tripId && String(s.tripId)).filter(Boolean))];
  const names = new Map((await Trip.find({ _id: { $in: tripIds } }, 'name').lean() as any[]).map(t => [String(t._id), t.name]));

  return json({
    status:  clip.status,
    error:   clip.error ?? null,
    summary: clip.summary ?? '',
    saved: saved.map(s => ({
      name:     s.name,
      kind:     s.kind,
      category: isCategory(s.category) ? CATEGORY_LABEL[s.category as ClipCategory] : String(s.category ?? ''),
      where:    s.tripId ? names.get(String(s.tripId)) ?? s.city : s.city ? `${s.city} (no trip yet)` : '',
      pinned:   Number.isFinite(s.coordinates?.lat),
    })),
  });
}
