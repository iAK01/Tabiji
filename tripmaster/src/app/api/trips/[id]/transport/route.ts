import { NextResponse }    from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic            from '@anthropic-ai/sdk';
import connectDB            from '@/lib/mongodb/connection';
import Trip                 from '@/lib/mongodb/models/Trip';
import TripLogistics        from '@/lib/mongodb/models/TripLogistics';
import TripItinerary        from '@/lib/mongodb/models/TripItinerary';
import User                 from '@/lib/mongodb/models/User';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransportStep {
  label:             string;
  method:            'train' | 'bus' | 'metro' | 'taxi' | 'rideshare' | 'car' | 'walk' | 'ferry' | 'other';
  description:       string;
  operator?:         string;
  searchTerms?:      string;
  estimatedDuration?: string;
  uncertainty?:      string | null;
}

export interface TransportLeg {
  status:              'sorted' | 'gap' | 'no_data' | 'not_applicable';
  sortedDetail?:       string;
  firstStop?:          { type: 'hotel' | 'venue'; name: string; address?: string };
  timePressure?:       { active: boolean; reason: string };
  isMultiCity?:        boolean;
  earlyMorningWarning?: boolean;
  earlyMorningDetail?: string;
  steps:               TransportStep[];
  suggestedDate?:      string; // YYYY-MM-DD, set server-side for "Add to itinerary"
}

export interface GroundTransportPlan {
  preDeparture:  TransportLeg;
  arrivalLeg:    TransportLeg;
  returnLeg:     TransportLeg;
  homeCloseout:  TransportLeg;
  generatedAt:   string;
}

// ─── Context builder ──────────────────────────────────────────────────────────

function formatFlights(flights: any[]): string {
  if (!flights.length) return 'None';
  return flights.map(f => {
    const num  = f.details?.flightNumber ?? '';
    const from = f.departureLocation ?? '';
    const to   = f.arrivalLocation   ?? '';
    const dep  = f.departureTime ? new Date(f.departureTime).toISOString() : '';
    const arr  = f.arrivalTime   ? new Date(f.arrivalTime).toISOString()   : '';
    return `  ${num} ${from} → ${to}, departs ${dep}, arrives ${arr}`.trim();
  }).join('\n');
}

function formatAccom(accommodation: any[]): string {
  if (!accommodation?.length) return 'Not yet booked';
  return accommodation.map(a => `  ${a.name ?? 'Hotel'}${a.address ? `, ${a.address}` : ''}`).join('\n');
}

function formatVenues(venues: any[]): string {
  if (!venues?.length) return 'None added';
  return venues.map(v => {
    const when = [v.date, v.time].filter(Boolean).join(' at ');
    return `  ${v.name ?? 'Venue'}${v.address ? `, ${v.address}` : ''}${when ? ` — ${when}` : ''}`;
  }).join('\n');
}

function formatItineraryDay(day: any): string {
  if (!day?.stops?.length) return '  (empty)';
  return day.stops
    .filter((s: any) => s.scheduledStart)
    .sort((a: any, b: any) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
    .map((s: any) => {
      const t = new Date(s.scheduledStart).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `  ${t} — ${s.name}${s.address ? ` (${s.address})` : ''}`;
    }).join('\n');
}

// ─── Classify flights into outbound / return ──────────────────────────────────

function classifyFlights(transport: any[], trip: any) {
  const startMs = trip.startDate ? new Date(trip.startDate).getTime() : 0;
  const endMs   = trip.endDate   ? new Date(trip.endDate).getTime()   : Infinity;
  const midMs   = (startMs + endMs) / 2;

  const flights = transport.filter(t => t.type === 'flight');
  const outbound = flights.filter(f => {
    const depMs = f.departureTime ? new Date(f.departureTime).getTime() : 0;
    return depMs <= midMs;
  }).sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  const returning = flights.filter(f => {
    const depMs = f.departureTime ? new Date(f.departureTime).getTime() : 0;
    return depMs > midMs;
  }).sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  return { outbound, returning };
}

// ─── Find parking entry at a given airport ────────────────────────────────────

function findParking(transport: any[], airportCode: string): any | null {
  const iata = airportCode.split('—')[0].trim().split(' ')[0].trim().toUpperCase();
  return transport.find(t => {
    if (t.type !== 'parking') return false;
    const loc = (t.departureLocation ?? '').toUpperCase();
    return loc.includes(iata);
  }) ?? null;
}

// ─── Check itinerary for a matching travel stop ───────────────────────────────
// Returns the stop text if a stop on the given day mentions the airport/city

function findItineraryTravelStop(days: any[], date: string, airportCode: string, cityName: string): string | null {
  const iata = airportCode.split('—')[0].trim().split(' ')[0].trim().toUpperCase();
  const day  = days.find((d: any) => d.date?.split('T')[0] === date?.split('T')[0]);
  if (!day?.stops?.length) return null;

  for (const stop of day.stops) {
    const text = `${stop.name ?? ''} ${stop.address ?? ''} ${stop.notes ?? ''}`.toUpperCase();
    if (text.includes(iata) || (cityName && text.includes(cityName.toUpperCase()))) {
      const t = stop.scheduledStart
        ? new Date(stop.scheduledStart).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false })
        : null;
      return `${t ? `${t} — ` : ''}${stop.name}`;
    }
  }
  return null;
}

// ─── Build the Claude prompt ──────────────────────────────────────────────────

function buildPrompt(ctx: {
  originCity:         string;
  originCountry:      string;
  destinationCity:    string;
  destinationCountry: string;
  timezone:           string;
  outboundFlights:    any[];
  returnFlights:      any[];
  accommodation:      any[];
  venues:             any[];
  arrivalDayStops:    string;
  returnDayStops:     string;
  dayBeforeReturnStops: string;
  preDepartureFound:  string | null;
  homeCloseoutFound:  string | null;
  parkingAtDep:       any | null;
  parkingAtReturn:    any | null;
  arrivalDate:        string;
  returnDepartureDate: string;
}): string {
  const lastOutbound = ctx.outboundFlights[ctx.outboundFlights.length - 1];
  const firstReturn  = ctx.returnFlights[0];

  const arrivalAirport = lastOutbound?.arrivalLocation   ?? 'unknown';
  const arrivalTime    = lastOutbound?.arrivalTime        ?? null;
  const returnAirport  = firstReturn?.departureLocation  ?? 'unknown';
  const returnDepTime  = firstReturn?.departureTime       ?? null;

  const returnHour = returnDepTime ? new Date(returnDepTime).getHours() : null;
  const earlyFlag  = returnHour !== null && returnHour < 7
    ? `⚠️ EARLY DEPARTURE: Return flight departs at ${new Date(returnDepTime!).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false })}. This is before 07:00 — standard public transport may NOT be running. You MUST address this.`
    : null;

  const parkingNote = ctx.parkingAtDep
    ? `Parking booked at ${ctx.parkingAtDep.departureLocation ?? 'departure airport'}: ${ctx.parkingAtDep.details?.parkingProduct ?? ''}${ctx.parkingAtDep.confirmationNumber ? ` (ref: ${ctx.parkingAtDep.confirmationNumber})` : ''}`
    : 'No parking booked at departure airport';

  const returnParkingNote = ctx.parkingAtReturn
    ? `Parking booked at home airport: ${ctx.parkingAtReturn.departureLocation ?? ''}${ctx.parkingAtReturn.details?.parkingProduct ? ` — ${ctx.parkingAtReturn.details.parkingProduct}` : ''}${ctx.parkingAtReturn.confirmationNumber ? ` (ref: ${ctx.parkingAtReturn.confirmationNumber})` : ''}`
    : null;

  return `You are a ground transport advisor for a traveller. Your job is to identify gaps and provide step-by-step guidance on HOW to bridge them — what transport to take, what to search for, what operator to use. You do NOT provide specific timetables, live prices, or platform numbers. If you are uncertain about any detail, say so explicitly.

JOURNEY OVERVIEW:
- Travelling from: ${ctx.originCity}, ${ctx.originCountry}
- Destination: ${ctx.destinationCity}, ${ctx.destinationCountry}
- Local timezone: ${ctx.timezone}

OUTBOUND FLIGHTS:
${formatFlights(ctx.outboundFlights) || 'None'}

RETURN FLIGHTS:
${formatFlights(ctx.returnFlights) || 'None'}

ACCOMMODATION:
${formatAccom(ctx.accommodation)}

VENUES:
${formatVenues(ctx.venues)}

ITINERARY — ARRIVAL DAY (${ctx.arrivalDate}):
${ctx.arrivalDayStops}

ITINERARY — DAY BEFORE RETURN (${ctx.returnDepartureDate}):
${ctx.dayBeforeReturnStops}

ITINERARY — RETURN DEPARTURE DAY:
${ctx.returnDayStops}

PRE-DEPARTURE STATUS (${ctx.originCity} → departure airport):
${ctx.preDepartureFound ? `Already in itinerary: "${ctx.preDepartureFound}"` : 'NOT found in itinerary or transport — this is a gap'}
${parkingNote}

HOME CLOSE-OUT STATUS (arrival airport → ${ctx.originCity}):
${ctx.homeCloseoutFound ? `Already covered: "${ctx.homeCloseoutFound}"` : `NOT found — this may be a gap`}
${returnParkingNote ? returnParkingNote : 'No parking noted for home airport'}

${earlyFlag ? earlyFlag + '\n' : ''}
RULES:
- NEVER invent specific departure times, platform numbers, or prices
- If a leg is multi-city (arrival airport city ≠ destination city), always include the intercity step
- For time pressure: if the first scheduled event on arrival day starts within 3 hours of landing, flag it and recommend going directly to that location rather than the hotel
- For early morning returns (before 07:00): explicitly state that standard public transport likely will not be running and recommend taxi/rideshare as the reliable option — naming relevant apps (Bolt, Uber, FreeNow, or local equivalent)
- For "sorted" legs: acknowledge what's already planned and add any useful notes — do not reinvent it
- For "no_data" legs: set status to "no_data" if there's nothing to navigate to (no hotel AND no venue)
- Use "not_applicable" only if the leg genuinely doesn't exist (e.g. no return flight)
- Be specific about operator names and search terms — "search PKP Intercity for Warsaw Centralna to Łódź Fabryczna" is good; "search online for trains" is not
- For taxi/rideshare steps, name the specific apps available in that city (Bolt, Uber, FreeNow, local apps)
- For the home close-out leg: if parking is booked, confirm it; if not, flag whether the traveller needs to plan onward transport from the airport to their home city

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.

{
  "preDeparture": {
    "status": "sorted|gap|no_data|not_applicable",
    "sortedDetail": "string or null",
    "isMultiCity": false,
    "steps": [
      {
        "label": "short label, e.g. Drive to airport",
        "method": "car|train|bus|metro|taxi|rideshare|walk|ferry|other",
        "description": "clear, actionable, specific description",
        "operator": "operator name or null",
        "searchTerms": "what to search for, or null",
        "estimatedDuration": "e.g. ~2.5 hours or null",
        "uncertainty": "any caveat, or null"
      }
    ]
  },
  "arrivalLeg": {
    "status": "sorted|gap|no_data|not_applicable",
    "sortedDetail": null,
    "firstStop": { "type": "hotel|venue", "name": "...", "address": "..." },
    "timePressure": { "active": true, "reason": "..." },
    "isMultiCity": true,
    "steps": [...]
  },
  "returnLeg": {
    "status": "sorted|gap|no_data|not_applicable",
    "sortedDetail": null,
    "isMultiCity": true,
    "earlyMorningWarning": false,
    "earlyMorningDetail": null,
    "steps": [...]
  },
  "homeCloseout": {
    "status": "sorted|gap|no_data|not_applicable",
    "sortedDetail": "string describing what's already in place, or null",
    "isMultiCity": false,
    "steps": [...]
  }
}`;
}

// ─── GET — return cached plan ─────────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ plan: trip.groundTransport ?? null });
}

// ─── POST — generate or regenerate plan ───────────────────────────────────────

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let logistics: any = null;
  let itinerary: any = null;
  try {
    [logistics, itinerary] = await Promise.all([
      TripLogistics.findOne({ tripId: id }),
      TripItinerary.findOne({ tripId: id }),
    ]);
  } catch (dbErr: any) {
    console.error('Ground transport DB error:', dbErr?.message);
    return NextResponse.json({ error: `Database error: ${dbErr?.message}` }, { status: 500 });
  }

  const transport     = logistics?.transportation ?? [];
  const accommodation = logistics?.accommodation  ?? [];
  const venues        = logistics?.venues         ?? [];
  const days          = itinerary?.days           ?? [];

  const { outbound, returning } = classifyFlights(transport, trip);

  if (!outbound.length && !returning.length) {
    return NextResponse.json({ error: 'No flights found. Add your flights to Logistics first.' }, { status: 400 });
  }

  if (!accommodation.length && !venues.length) {
    return NextResponse.json({ error: 'Add at least one hotel or venue so we know where you are heading.' }, { status: 400 });
  }

  // Key dates
  const lastOutbound   = outbound[outbound.length - 1];
  const firstReturn    = returning[0];
  const arrivalDate    = lastOutbound?.arrivalTime
    ? new Date(lastOutbound.arrivalTime).toISOString().split('T')[0]
    : trip.startDate?.toISOString().split('T')[0] ?? '';
  const returnDepDate  = firstReturn?.departureTime
    ? new Date(firstReturn.departureTime).toISOString().split('T')[0]
    : trip.endDate?.toISOString().split('T')[0] ?? '';

  // Departure airport (first outbound flight's departure)
  const depAirport     = outbound[0]?.departureLocation ?? '';
  const depDate        = outbound[0]?.departureTime
    ? new Date(outbound[0].departureTime).toISOString().split('T')[0]
    : '';
  const depDayBefore   = depDate
    ? new Date(new Date(depDate).getTime() - 86400000).toISOString().split('T')[0]
    : '';

  // Pre-departure: check itinerary for a drive/travel stop toward the departure airport on dep day or day before
  const preDepartureFound =
    findItineraryTravelStop(days, depDate,    depAirport, depAirport.split('—').pop()?.trim() ?? '') ??
    findItineraryTravelStop(days, depDayBefore, depAirport, depAirport.split('—').pop()?.trim() ?? '');

  // Home closeout: return airport is the arrival of the last return flight
  const lastReturn       = returning[returning.length - 1];
  const homeAirport      = lastReturn?.arrivalLocation ?? '';
  const homeArrDate      = lastReturn?.arrivalTime
    ? new Date(lastReturn.arrivalTime).toISOString().split('T')[0]
    : '';
  const homeCloseoutFound = homeArrDate
    ? findItineraryTravelStop(days, homeArrDate, homeAirport, trip.origin?.city ?? '')
    : null;

  // Parking
  const parkingAtDep    = findParking(transport, depAirport);
  const parkingAtReturn = findParking(transport, homeAirport);

  // Itinerary context for the prompt
  const arrivalDayObj      = days.find((d: any) => d.date?.split('T')[0] === arrivalDate);
  const returnDepDayObj    = days.find((d: any) => d.date?.split('T')[0] === returnDepDate);
  const dayBeforeReturnObj = returnDepDate
    ? days.find((d: any) => d.date?.split('T')[0] === new Date(new Date(returnDepDate).getTime() - 86400000).toISOString().split('T')[0])
    : null;

  const prompt = buildPrompt({
    originCity:          trip.origin?.city         ?? 'your home city',
    originCountry:       trip.origin?.country      ?? '',
    destinationCity:     trip.destination?.city    ?? '',
    destinationCountry:  trip.destination?.country ?? '',
    timezone:            trip.destination?.timezone ?? 'Europe/London',
    outboundFlights:     outbound,
    returnFlights:       returning,
    accommodation,
    venues,
    arrivalDayStops:     formatItineraryDay(arrivalDayObj),
    returnDayStops:      formatItineraryDay(returnDepDayObj),
    dayBeforeReturnStops: formatItineraryDay(dayBeforeReturnObj),
    preDepartureFound,
    homeCloseoutFound:   homeCloseoutFound ?? (parkingAtReturn ? 'Parking booked — car collection' : null),
    parkingAtDep,
    parkingAtReturn,
    arrivalDate,
    returnDepartureDate: returnDepDate,
  });

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');

    // Extract the outermost JSON object robustly — Claude sometimes adds preamble/postamble
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Ground transport: no JSON object in response. Raw:', raw.slice(0, 500));
      return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // Inject server-computed dates for "Add to itinerary" — not asked of Claude
    const depDayStr  = outbound[0]?.departureTime
      ? new Date(outbound[0].departureTime).toISOString().split('T')[0]
      : depDayBefore;
    if (parsed.preDeparture)  parsed.preDeparture.suggestedDate  = depDayBefore || depDayStr;
    if (parsed.arrivalLeg)    parsed.arrivalLeg.suggestedDate    = arrivalDate;
    if (parsed.returnLeg)     parsed.returnLeg.suggestedDate     = returnDepDate;
    if (parsed.homeCloseout)  parsed.homeCloseout.suggestedDate  = homeArrDate;

    const plan: GroundTransportPlan = { ...parsed, generatedAt: new Date().toISOString() };

    await Trip.findByIdAndUpdate(id, { groundTransport: plan });
    return NextResponse.json({ plan });

  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error('Ground transport error:', message);
    return NextResponse.json({ error: `Failed to generate transport plan: ${message}` }, { status: 500 });
  }
}

// ─── DELETE — clear cached plan ───────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await Trip.findByIdAndUpdate(id, { groundTransport: null });
  return NextResponse.json({ ok: true });
}
