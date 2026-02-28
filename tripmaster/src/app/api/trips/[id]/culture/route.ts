import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { getFreeCultureAccess } from '@/lib/data/free-cultural-access';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CultureHighlight {
  name:        string;
  description: string;
  type:        'museum' | 'gallery' | 'landmark' | 'neighbourhood' | 'experience' | 'food' | 'music' | 'other';
  tip?:        string;
  free?:       boolean;
}

export interface CultureBriefing {
  destination:   string;
  highlights:    CultureHighlight[];
  neighbourhood: { name: string; description: string } | null;
  practicalNote: string;
  generatedAt:   string;
}

// ─── Free culture events via the existing engine ─────────────────────────────

function checkFreeEvents(
  startDate:   string,
  endDate:     string,
  countryCode: string,
) {
  if (!countryCode) return { freeDays: [], standing: [] };

  const alert = getFreeCultureAccess(
    countryCode.toUpperCase(),
    new Date(startDate),
    new Date(endDate),
  );

  if (!alert) return { freeDays: [], standing: [] };

  return {
    freeDays:  alert.freeDays  ?? [],
    standing:  alert.standing  ?? [],
    summary:   alert.programSummary ?? null,
    tip:       alert.tip ?? null,
  };
}

// ─── Anthropic call ───────────────────────────────────────────────────────────

async function generateBriefing(
  city: string, country: string, tripType: string, purpose: string, nights: number,
): Promise<CultureBriefing> {
  const prompt = `You are a well-travelled cultural guide. Generate a concise, opinionated cultural briefing for a traveller visiting ${city}, ${country}.

Trip context:
- Type: ${tripType}
- Purpose: ${purpose || 'general travel'}
- Duration: ${nights} night${nights !== 1 ? 's' : ''}

Respond with valid JSON only, no markdown, no preamble:
{
  "highlights": [
    {
      "name": "string",
      "description": "1-2 sentences, specific and opinionated — not generic tourist blurb",
      "type": "museum|gallery|landmark|neighbourhood|experience|food|music|other",
      "tip": "optional practical tip",
      "free": true or false
    }
  ],
  "neighbourhood": { "name": "string", "description": "string" },
  "practicalNote": "one genuinely useful city-specific tip a guidebook might miss"
}

Rules:
- 5 to 7 highlights maximum. Be specific — name actual places.
- If the trip is work or music-industry related, lean toward cultural depth over tourist checklist.
- Do not mention visa, currency, adapters — handled elsewhere.`;

  const msg    = await anthropic.messages.create({
    model: 'claude-sonnet-4-5', max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const text   = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

  return {
    destination:   `${city}, ${country}`,
    highlights:    parsed.highlights    ?? [],
    neighbourhood: parsed.neighbourhood ?? null,
    practicalNote: parsed.practicalNote ?? '',
    generatedAt:   new Date().toISOString(),
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const freeAccess = checkFreeEvents(
    trip.startDate,
    trip.endDate,
    trip.destination?.countryCode ?? '',
  );

  return NextResponse.json({
    culture: {
      briefing:    trip.culture?.briefing    ?? null,
      freeAccess,
      generatedAt: trip.culture?.generatedAt ?? null,
    },
  });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const city    = trip.destination?.city;
  const country = trip.destination?.country;
  if (!city || !country) {
    return NextResponse.json({ error: 'Trip needs a destination city and country' }, { status: 400 });
  }

  try {
    const briefing   = await generateBriefing(city, country, trip.tripType ?? 'leisure', trip.purpose ?? '', trip.nights ?? 1);
    const freeAccess = checkFreeEvents(trip.startDate, trip.endDate, trip.destination?.countryCode ?? '');

    await Trip.findByIdAndUpdate(id, {
      'culture.briefing':    briefing,
      'culture.generatedAt': briefing.generatedAt,
    });

    return NextResponse.json({ culture: { briefing, freeAccess, generatedAt: briefing.generatedAt } });
  } catch (err: any) {
    console.error('Culture briefing error:', err);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}