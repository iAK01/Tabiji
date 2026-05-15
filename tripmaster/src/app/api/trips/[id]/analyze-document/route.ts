import { NextResponse }     from 'next/server';
import { getServerSession }  from 'next-auth';
import Anthropic             from '@anthropic-ai/sdk';
import connectDB             from '@/lib/mongodb/connection';
import Trip                  from '@/lib/mongodb/models/Trip';
import User                  from '@/lib/mongodb/models/User';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { gcsUrl } = await req.json();
  if (!gcsUrl) return NextResponse.json({ error: 'gcsUrl required' }, { status: 400 });

  const pdfRes = await fetch(gcsUrl);
  if (!pdfRes.ok) return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  const pdfBase64 = Buffer.from(await pdfRes.arrayBuffer()).toString('base64');

  const tripDates = [
    trip.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : null,
    trip.endDate   ? new Date(trip.endDate).toISOString().split('T')[0]   : null,
  ].filter(Boolean).join(' to ');

  const tz      = trip.destination?.timezone ?? 'UTC';
  const city    = trip.destination?.city    ?? '';
  const country = trip.destination?.country ?? '';

  const prompt = `You are extracting structured trip data from an event document for a travel planning app.

Context:
- Trip: ${trip.name}
- Destination: ${city}, ${country}
- Trip dates: ${tripDates || 'unknown'}
- Local timezone: ${tz}

Extract ALL of the following from this document:
1. Accommodation: hotels, guesthouses, or any place to stay
2. Venues: named places for events, concerts, conferences, meals (distinct from accommodation)
3. Itinerary stops: every scheduled session, concert, workshop, panel, meal, or activity with a specific time

Rules:
- Dates: YYYY-MM-DD format
- Times: HH:MM 24h format
- scheduledStart: full ISO timestamp in ${tz} timezone, e.g. "2026-07-22T20:00:00"
- duration: in minutes; estimate from end time if given, otherwise use type defaults
- If a venue serves double duty (e.g. concert venue that is also the conference hall), include it once in venues
- Include ALL scheduled items in itineraryStops even if the venue also appears in venues

Valid venue types: concert, conference, restaurant, sports, attraction, business, other
Valid stop types: flight, hotel, meeting, meal, breakfast, activity, sightseeing, transport, transfer, checkin, work, gig, other

Return ONLY valid JSON, no markdown, no explanation:

{
  "accommodation": [
    { "type": "hotel", "name": "...", "address": "...", "notes": "..." }
  ],
  "venues": [
    { "type": "concert", "name": "...", "address": "...", "date": "YYYY-MM-DD or null", "time": "HH:MM or null", "notes": "..." }
  ],
  "itineraryStops": [
    { "name": "...", "type": "meeting", "date": "YYYY-MM-DD", "scheduledStart": "2026-07-22T14:30:00", "duration": 90, "address": "...", "notes": "..." }
  ]
}`;

  try {
    const msg = await anthropic.messages.create(
      {
        model:      'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type:   'document',
                source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
              } as any,
              { type: 'text', text: prompt },
            ],
          },
        ],
      },
      { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } },
    );

    const raw       = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
    const extracted = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return NextResponse.json({ extracted });
  } catch (err: any) {
    console.error('Document analysis error:', err);
    return NextResponse.json({ error: 'Failed to analyse document' }, { status: 500 });
  }
}
