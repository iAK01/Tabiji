import { NextResponse }   from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic            from '@anthropic-ai/sdk';
import connectDB            from '@/lib/mongodb/connection';
import Trip                 from '@/lib/mongodb/models/Trip';
import TripLogistics        from '@/lib/mongodb/models/TripLogistics';
import User                 from '@/lib/mongodb/models/User';
import { getFreeCultureAccess } from '@/lib/data/free-cultural-access';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CultureHighlight {
  name:         string;
  description:  string;
  type:         'museum' | 'gallery' | 'landmark' | 'experience' | 'food' | 'coffee' | 'park' | 'music' | 'other';
  category:     'cultural' | 'coffee' | 'park';
  tip?:         string;
  free?:        boolean;
  address?:     string;
  coordinates?: { lat: number; lng: number };
  nearVenue?:   string;
}

export interface CultureBriefing {
  destination:   string;
  highlights:    CultureHighlight[];
  neighbourhood: {
    name:         string;
    description:  string;
    address?:     string;
    coordinates?: { lat: number; lng: number };
  } | null;
  practicalNote: string;
  generatedAt:   string;
}

// ─── Mapbox geocoding ─────────────────────────────────────────────────────────
// Resolves a place name to a verified address + coordinates.
// Uses the place name + city as the search query for best accuracy.

async function geocode(query: string): Promise<{ address: string; lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}`;
    const res  = await fetch(url);
    const data = await res.json();
    const f    = data?.features?.[0];
    if (!f) return null;
    const [lng, lat] = f.center;
    return { address: f.place_name, lat, lng };
  } catch {
    return null;
  }
}

// ─── Build the prompt ─────────────────────────────────────────────────────────

function buildPrompt({
  city, country, tripType, purpose, nights, hotelName, hotelAddress,
}: {
  city: string; country: string; tripType: string; purpose: string;
  nights: number; hotelName: string | null; hotelAddress: string | null;
}): string {

  const hotelLine = hotelName
    ? `Hotel: ${hotelName}${hotelAddress ? `, ${hotelAddress}` : ''}`
    : `Hotel: not set — use ${city} city centre as proximity anchor`;

  const includeNeighbourhood = nights >= 2
    ? `"neighbourhood": { "name": "neighbourhood name", "description": "why this is the right neighbourhood for evening exploration — be specific about what makes it worth it", "searchQuery": "neighbourhood name, ${city}" }`
    : `"neighbourhood": null`;

  return `You are generating a personalised travel briefing for someone visiting ${city}, ${country}.

Trip: ${tripType} | ${nights} night${nights !== 1 ? 's' : ''} | ${purpose || 'general travel'}
${hotelLine}

Return ONLY valid JSON. No markdown. No explanation. No extra text.

{
  "highlights": [
    {
      "name": "exact, real place name",
      "description": "2–3 sentences. Specific and opinionated. Name what to see, what to order, what makes it worth it. Not generic.",
      "type": "museum|gallery|landmark|experience|food|coffee|park|music|other",
      "category": "cultural|coffee|park",
      "tip": "one concrete practical tip — when to go, what to order, what to skip, insider detail",
      "free": true or false,
      "searchQuery": "place name, ${city} — specific enough for a map search to find the right result"
    }
  ],
  ${includeNeighbourhood},
  "practicalNote": "one city-specific tip that a first-time visitor genuinely needs and a guidebook would miss"
}

REQUIRED highlight structure — include ALL of these:
1. CULTURAL: 3 highlights (museum / landmark / gallery / experience). Real places. Specific opinions.
2. COFFEE: 1 independent café near the hotel. Name it. Say why it is the best option — the coffee style, the room, the vibe. Not a chain.
3. COFFEE: 1 additional café if the city warrants it (different neighbourhood, different style). Optional — only include if genuinely good.
4. PARK: 1 green space or walking route near the hotel. Say what makes it worth the walk — wildlife, views, a specific feature.

Total: 5–7 highlights.

Rules:
- Only real places that exist. If unsure about a café name, use a place you are confident about.
- "free" = true only if there is no standard admission charge
- Do not mention visa, currency, transport, electrical adapters — handled elsewhere
- If trip is work-focused, lean toward walkable, calm, quick-visit options`;
}

// ─── Generate briefing ────────────────────────────────────────────────────────

async function generateBriefing(ctx: {
  city: string; country: string; tripType: string; purpose: string;
  nights: number; hotelName: string | null; hotelAddress: string | null;
}): Promise<CultureBriefing> {

  const msg    = await anthropic.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 2048,
    messages:   [{ role: 'user', content: buildPrompt(ctx) }],
  });

  const raw    = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

  // Geocode all highlights in parallel for verified addresses + coordinates
  const highlights: CultureHighlight[] = await Promise.all(
    (parsed.highlights ?? []).map(async (h: any) => {
      const geo = await geocode(h.searchQuery ?? `${h.name}, ${ctx.city}`);
      return {
        name:         h.name,
        description:  h.description,
        type:         h.type  ?? 'other',
        category:     h.category ?? (h.type === 'coffee' ? 'coffee' : h.type === 'park' ? 'park' : 'cultural'),
        tip:          h.tip   ?? undefined,
        free:         h.free  ?? false,
        address:      geo?.address ?? undefined,
        coordinates:  geo ? { lat: geo.lat, lng: geo.lng } : undefined,
        nearVenue:    h.nearVenue ?? undefined,
      } as CultureHighlight;
    })
  );

  // Geocode neighbourhood
  let neighbourhood: CultureBriefing['neighbourhood'] = null;
  if (parsed.neighbourhood) {
    const geo = await geocode(parsed.neighbourhood.searchQuery ?? `${parsed.neighbourhood.name}, ${ctx.city}`);
    neighbourhood = {
      name:        parsed.neighbourhood.name,
      description: parsed.neighbourhood.description,
      address:     geo?.address,
      coordinates: geo ? { lat: geo.lat, lng: geo.lng } : undefined,
    };
  }

  return {
    destination:   `${ctx.city}, ${ctx.country}`,
    highlights,
    neighbourhood,
    practicalNote: parsed.practicalNote ?? '',
    generatedAt:   new Date().toISOString(),
  };
}

// ─── Free culture access ──────────────────────────────────────────────────────

function buildFreeAccess(startDate: Date, endDate: Date, countryCode: string) {
  if (!countryCode) return { freeDays: [], standing: [], summary: null, tip: null };
  const alert = getFreeCultureAccess(countryCode.toUpperCase(), startDate, endDate);
  if (!alert) return { freeDays: [], standing: [], summary: null, tip: null };
  return {
    freeDays: alert.freeDays    ?? [],
    standing: alert.standing    ?? [],
    summary:  alert.programSummary ?? null,
    tip:      alert.tip         ?? null,
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

  const freeAccess = buildFreeAccess(
    new Date(trip.startDate),
    new Date(trip.endDate),
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

// ─── POST ─────────────────────────────────────────────────────────────────────

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

  // Pull hotel from logistics
  const logistics    = await TripLogistics.findOne({ tripId: id });
  const firstHotel   = logistics?.accommodation?.[0];
  const hotelName    = firstHotel?.name    ?? null;
  const hotelAddress = firstHotel?.address ?? null;

  try {
    const briefing   = await generateBriefing({
      city, country,
      tripType:     trip.tripType ?? 'leisure',
      purpose:      trip.purpose  ?? '',
      nights:       trip.nights   ?? 1,
      hotelName,
      hotelAddress,
    });

    const freeAccess = buildFreeAccess(
      new Date(trip.startDate),
      new Date(trip.endDate),
      trip.destination?.countryCode ?? '',
    );

    await Trip.findByIdAndUpdate(id, {
      'culture.briefing':    briefing,
      'culture.generatedAt': briefing.generatedAt,
    });

    return NextResponse.json({
      culture: { briefing, freeAccess, generatedAt: briefing.generatedAt },
    });

  } catch (err: any) {
    console.error('Culture briefing error:', err);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}