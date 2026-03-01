import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripPacking from '@/lib/mongodb/models/TripPacking';
import TripIntelligence from '@/lib/mongodb/models/TripIntelligence';
import TripFile from '@/lib/mongodb/models/TripFile';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import { deleteFile } from '@/lib/utils/storage';
import User from '@/lib/mongodb/models/User';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ trip });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const body = await req.json();

  const existingTrip = await Trip.findOne({ _id: id, userId: user._id });
  if (!existingTrip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const trip = await Trip.findOneAndUpdate(
    { _id: id, userId: user._id },
    { ...body },
    { new: true }
  );

  // If dates changed, regenerate itinerary days
  const datesChanged =
    existingTrip.startDate?.toISOString().split('T')[0] !== body.startDate ||
    existingTrip.endDate?.toISOString().split('T')[0] !== body.endDate;

  if (datesChanged && body.startDate && body.endDate) {
    const TripItinerary = (await import('@/lib/mongodb/models/TripItinerary')).default;
    const days = generateDays(body.startDate, body.endDate);
    await TripItinerary.findOneAndUpdate(
      { tripId: id },
      { days },
      { upsert: true }
    );
  }

  return NextResponse.json({ trip });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { id: tripId } = await params;
  await connectDB();

  // Verify ownership before touching anything
const user = await User.findOne({ email: session.user.email });
const trip = await Trip.findOne({ _id: tripId, userId: user._id }).lean() as unknown as any;
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const receipt: Record<string, any> = {};

  // ── Step 1: GCS — delete physical attachments first ────────────────────────
  // If the DB delete fails later, we've lost the files — but the alternative
  // (DB first) risks orphaned GCS files with no way to clean them up.
  // Files without a gcsPath are links/notes/contacts — skip silently.
const gcsFiles = await TripFile.find({ tripId, gcsPath: { $exists: true, $ne: null } }).lean() as any[];
  const gcsDeletions = await Promise.allSettled(
    gcsFiles.map((f: any) => deleteFile(f.gcsPath))
  );
  receipt.gcsFilesDeleted = gcsDeletions.filter(r => r.status === 'fulfilled').length;
  receipt.gcsFilesFailed  = gcsDeletions.filter(r => r.status === 'rejected').length;

  // ── Step 2: TripFile documents ─────────────────────────────────────────────
  const filesResult = await TripFile.deleteMany({ tripId });
  receipt.tripFilesDeleted = filesResult.deletedCount;

  // ── Step 3: PushNotificationLog ────────────────────────────────────────────
  const logsResult = await PushNotificationLog.deleteMany({ tripId });
  receipt.pushLogsDeleted = logsResult.deletedCount;

  // ── Step 4: TripItinerary ──────────────────────────────────────────────────
  await TripItinerary.deleteOne({ tripId });
  receipt.itineraryDeleted = true;

  // ── Step 5: TripLogistics ──────────────────────────────────────────────────
  await TripLogistics.deleteOne({ tripId });
  receipt.logisticsDeleted = true;

  // ── Step 6: TripPacking ────────────────────────────────────────────────────
  await TripPacking.deleteOne({ tripId });
  receipt.packingDeleted = true;

  // ── Step 7: TripIntelligence ───────────────────────────────────────────────
  await TripIntelligence.deleteOne({ tripId });
  receipt.intelligenceDeleted = true;

  // ── Step 8: Trip itself ────────────────────────────────────────────────────
  await Trip.findByIdAndDelete(tripId);
  receipt.tripDeleted = true;

  return NextResponse.json({ success: true, receipt });
}

function generateDays(startDate: string, endDate: string) {
  const days = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start);
  let dayNumber = 1;
  while (current <= end) {
    days.push({ date: current.toISOString(), dayNumber, stops: [] });
    current.setDate(current.getDate() + 1);
    dayNumber++;
  }
  return days;
}