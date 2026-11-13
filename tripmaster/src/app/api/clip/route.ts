import { after } from 'next/server';
import mongoose from 'mongoose';
import Clip from '@/lib/mongodb/models/Clip';
import Trip from '@/lib/mongodb/models/Trip';
import { isCategory } from '@/lib/clip/categories';
import { json, preflight, unauthorised, userForKey } from '@/lib/clip/auth';
import { processClip } from '@/lib/clip/process';

// POST /api/clip — from the Safari clipper.
// Body: { url, title?, selection?, note?, screenshot? (data: URL, JPEG/PNG), tripId?, category? }
// Answered at once with the clip's id; reading and saving carry on after
// (GET /api/clip/[clipId] says how it went).

export const maxDuration = 300;

export function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const user = await userForKey(req);
  if (!user) return unauthorised();

  const body = await req.json().catch(() => null);
  const url  = typeof body?.url === 'string' ? body.url.trim() : '';
  const selection = typeof body?.selection === 'string' ? body.selection.trim().slice(0, 20_000) : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : '';

  let screenshot: { mediaType: 'image/jpeg' | 'image/png'; data: string } | null = null;
  if (typeof body?.screenshot === 'string') {
    const m = body.screenshot.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return json({ error: 'The screenshot isn’t a JPEG or PNG' }, 400);
    if (m[2].length > 6_000_000) return json({ error: 'The screenshot is too big' }, 413);
    screenshot = { mediaType: m[1] as 'image/jpeg' | 'image/png', data: m[2] };
  }
  if (!url && !selection && !screenshot) return json({ error: 'Nothing to clip' }, 400);

  let tripChoice: any = null;
  if (typeof body?.tripId === 'string' && body.tripId && body.tripId !== 'auto') {
    if (!mongoose.isValidObjectId(body.tripId)) return json({ error: 'No such trip' }, 400);
    const trip = await Trip.findOne({ _id: body.tripId, userId: user._id, deleted: false }, '_id').lean() as any;
    if (!trip) return json({ error: 'No such trip' }, 400);
    tripChoice = trip._id;
  }
  const categoryChoice = isCategory(body?.category) ? body.category : undefined;

  const clip = await Clip.create({
    userId: user._id,
    url: url || undefined,
    title: typeof body?.title === 'string' ? body.title.trim().slice(0, 300) : undefined,
    selection: selection || undefined,
    note: note || undefined,
    hadScreenshot: !!screenshot,
    tripChoice: tripChoice ?? undefined,
    categoryChoice,
  });

  const id = String(clip._id);
  after(() => processClip(id, screenshot).catch(err => console.error(`[clip] ${id}`, err)));
  return json({ id }, 202);
}
