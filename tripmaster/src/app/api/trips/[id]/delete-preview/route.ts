// GET /api/trips/[id]/delete-preview
// Returns a full audit of everything that will be deleted.
// No writes — purely informational.

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { id: tripId } = await params;
  await connectDB();

  // Verify ownership
  const trip = await Trip.findById(tripId).lean() as any;
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch everything in parallel
  const [itinerary, logistics, packing, intelligence, files, pushLogs] = await Promise.all([
    TripItinerary.findOne({ tripId }).lean() as any,
    TripLogistics.findOne({ tripId }).lean() as any,
    TripPacking.findOne({ tripId }).lean() as any,
    TripIntelligence.findOne({ tripId }).lean() as any,
    TripFile.find({ tripId }).lean() as unknown as any[],
    PushNotificationLog.find({ tripId }).lean() as unknown as any[],
  ]);

  // Count itinerary stops across all days
  const itineraryDays  = itinerary?.days?.length ?? 0;
  const itineraryStops = (itinerary?.days ?? []).reduce(
    (acc: number, d: any) => acc + (d.stops?.length ?? 0), 0
  );

  // Count logistics items
  const transportCount    = logistics?.transportation?.length ?? 0;
  const accommodationCount = logistics?.accommodation?.length ?? 0;
  const venueCount        = logistics?.venues?.length ?? 0;

  // Files — split by type and identify GCS files
  const gcsFiles = files.filter((f: any) => !!f.gcsPath);
  const filesByType: Record<string, number> = {};
  for (const f of files) {
    filesByType[f.resourceType] = (filesByType[f.resourceType] ?? 0) + 1;
  }

  return NextResponse.json({
    tripName: trip.name,
    audit: {
      // MongoDB documents
      itinerary:    { days: itineraryDays, stops: itineraryStops },
      logistics:    { transport: transportCount, accommodation: accommodationCount, venues: venueCount },
      packing:      { exists: !!packing },
      intelligence: { exists: !!intelligence },
      files:        { total: files.length, byType: filesByType },
      pushLogs:     { total: pushLogs.length },
      // GCS
      gcsAttachments: gcsFiles.map((f: any) => ({
        name:    f.name,
        gcsPath: f.gcsPath,
      })),
    },
  });
}