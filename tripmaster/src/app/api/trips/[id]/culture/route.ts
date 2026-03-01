import { NextResponse }      from 'next/server';
import { getServerSession }  from 'next-auth';
import Anthropic             from '@anthropic-ai/sdk';
import connectDB             from '@/lib/mongodb/connection';
import Trip                  from '@/lib/mongodb/models/Trip';
import TripLogistics         from '@/lib/mongodb/models/TripLogistics';
import User                  from '@/lib/mongodb/models/User';
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

// ─── Haversine distance (km) ──────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dG = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
             Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Mapbox geocoding with proximity + distance validation ───────────────────
// proximity: biases results toward destination
// maxKm: rejects results further than this from destination (prevents Bavaria situations)

async function geocode(
  query:        string,
  proximity:    { lat: number; lng: number },
  maxKm:        number = 60,
): Promise<{ address: string; lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const prox = `${proximity.lng},${proximity.lat}`;
    const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=3&proximity=${prox}&access_token=${token}`;
    const res  = await fetch(url);
    const data = await res.json();

    for (const f of (data?.features ?? [])) {
      const [lng, lat] = f.center;
      const dist = haversineKm(proximity.lat, proximity.lng, lat, lng);
      if (dist <= maxKm) {
        return { address: f.place_name, lat, lng };
      }
    }
    return null; // all results too far from destination — don't show wrong address
  } catch {
    return null;
  }
}

// ─── Build the prompt ─────────────────────────────────────────────────────────

function buildPrompt(ctx: {
  city:            string;
  country:         string;
  tripType:        string;
  purpose:         string;
  nights:          number;
  hotelName:       string | null;
  hotelAddress:    string | null;
  weatherSummary:  string | null;
  rainyDays:       number;
}): string {
  const hotelLine  = ctx.hotelName
    ? `Accommodation: ${ctx.hotelName}${ctx.hotelAddress ? `, ${ctx.hotelAddress}` : ''}`
    : `Accommodation: none specified — use ${ctx.city} city centre as the proximity anchor`;

  const weatherLine = ctx.weatherSummary
    ? `Weather during trip: ${ctx.weatherSummary}${ctx.rainyDays > 0 ? ` — ${ctx.rainyDays} rainy day(s) expected` : ''}`
    : null;

  const weatherInstruction = ctx.rainyDays > 0
    ? `IMPORTANT: There will be rain during this trip. Include at least one covered/indoor option in the cultural highlights. Flag indoor-friendly spots clearly in the tip.`
    : '';

  const includeNeighbourhood = ctx.nights >= 2
    ? `"neighbourhood": {
        "name": "neighbourhood name",
        "description": "why this neighbourhood is the right evening base — specific streets, vibe, what makes it different",
        "searchQuery": "neighbourhood name, ${ctx.city}, ${ctx.country}"
      }`
    : `"neighbourhood": null`;

  return `You are generating a personalised travel briefing for someone visiting ${ctx.city}, ${ctx.country}.

Trip details:
- Type: ${ctx.tripType}
- Purpose: ${ctx.purpose || 'general travel'}
- Duration: ${ctx.nights} night${ctx.nights !== 1 ? 's' : ''} (${ctx.nights === 0 ? 'day trip only' : 'overnight'})
- ${hotelLine}${weatherLine ? `\n- ${weatherLine}` : ''}

${weatherInstruction}

Respond ONLY with valid JSON. No markdown, no preamble, no explanation outside the JSON structure.

{
  "highlights": [
    {
      "name": "exact real place name",
      "description": "2–3 sentences. Specific and opinionated. Name what to actually see, do, or order. No generic tourist descriptions.",
      "type": "museum|gallery|landmark|experience|food|coffee|park|music|other",
      "category": "cultural|coffee|park",
      "tip": "one concrete, actionable tip — opening times, what to order, what to skip, insider detail",
      "free": true or false,
      "searchQuery": "${ctx.city}, ${ctx.country} — PLACE NAME ONLY, e.g. 'Jackie Clarke Collection, Ballina, County Mayo, Ireland' — must include city and country to geocode correctly"
    }
  ],
  ${includeNeighbourhood},
  "practicalNote": "one genuinely useful local tip that a guidebook would miss — specific to ${ctx.city}"
}

CRITICAL: searchQuery must always end with "${ctx.city}, ${ctx.country}" so it geocodes to the right town.
Example good searchQuery: "St Muredach's Cathedral, Ballina, County Mayo, Ireland"
Example BAD searchQuery: "Cathedral Ballina" — too vague, will geocode wrong

Required highlights:
1. CULTURAL (3 highlights, category: "cultural"): museum / landmark / gallery / experience specific to ${ctx.city}. Real places that exist in this exact town. Do not suggest places in other towns.
2. COFFEE (1 highlight, category: "coffee"): the single best independent café in ${ctx.city}. Name it specifically. Describe what makes it good — the coffee style, the atmosphere, what to order. Not a chain.
3. PARK (1 highlight, category: "park"): the best green space, riverside walk, or outdoor route in or immediately near ${ctx.city}. Say exactly what makes it worth visiting.

Total: 5 highlights (3 cultural + 1 coffee + 1 park).

Absolute rules:
- Only suggest places in ${ctx.city} itself — not in other towns or counties
- "free" is true only if there is genuinely no standard admission charge
- Do not mention visa, currency, adapter, transport or weather preparation — handled elsewhere`;
}

// ─── Generate briefing ────────────────────────────────────────────────────────

async function generateBriefing(ctx: {
  city: string; country: string; tripType: string; purpose: string;
  nights: number; hotelName: string | null; hotelAddress: string | null;
  weatherSummary: string | null; rainyDays: number;
  destCoords: { lat: number; lng: number };
}): Promise<CultureBriefing> {
  const msg    = await anthropic.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 2048,
    messages:   [{ role: 'user', content: buildPrompt(ctx) }],
  });

  const raw    = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

  // Geocode highlights in parallel — proximity-biased + distance-validated
  const highlights: CultureHighlight[] = await Promise.all(
    (parsed.highlights ?? []).map(async (h: any) => {
      const query = h.searchQuery ?? `${h.name}, ${ctx.city}, ${ctx.country}`;
      const geo   = await geocode(query, ctx.destCoords, 60);
      return {
        name:        h.name,
        description: h.description,
        type:        h.type     ?? 'other',
        category:    h.category ?? (h.type === 'coffee' ? 'coffee' : h.type === 'park' ? 'park' : 'cultural'),
        tip:         h.tip      ?? null,
        free:        h.free     ?? false,
        address:     geo?.address,
        coordinates: geo ? { lat: geo.lat, lng: geo.lng } : null,
        nearVenue:   h.nearVenue ?? null,
      } as CultureHighlight;
    })
  );

  // Geocode neighbourhood with same validation
  let neighbourhood: CultureBriefing['neighbourhood'] = null;
  if (parsed.neighbourhood) {
    const query = parsed.neighbourhood.searchQuery ?? `${parsed.neighbourhood.name}, ${ctx.city}, ${ctx.country}`;
    const geo   = await geocode(query, ctx.destCoords, 60);
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
    new Date(trip.startDate), new Date(trip.endDate),
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

  // Destination coordinates — used as geocoding anchor
  const destCoords = trip.destination?.coordinates?.lat
    ? { lat: trip.destination.coordinates.lat, lng: trip.destination.coordinates.lng }
    : null;

  if (!destCoords) {
    return NextResponse.json({ error: 'Trip destination has no coordinates — save the trip first to geocode the destination' }, { status: 400 });
  }

  // Hotel from logistics (supplementary context — may not exist)
  const logistics    = await TripLogistics.findOne({ tripId: id });
  const firstHotel   = logistics?.accommodation?.[0];
  const hotelName    = firstHotel?.name    ?? null;
  const hotelAddress = firstHotel?.address ?? null;

  // Weather context
  const weatherSummary = trip.weather?.summary ?? null;
  const rainyDays      = (trip.weather?.days ?? []).filter((d: any) => (d.precipMm ?? 0) > 1).length;

  try {
    const briefing = await generateBriefing({
      city, country,
      tripType:     trip.tripType ?? 'leisure',
      purpose:      trip.purpose  ?? '',
      nights:       trip.nights   ?? 0,
      hotelName,
      hotelAddress,
      weatherSummary,
      rainyDays,
      destCoords,
    });

    const freeAccess = buildFreeAccess(
      new Date(trip.startDate), new Date(trip.endDate),
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