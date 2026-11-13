import { NextResponse }     from 'next/server';
import { getServerSession }  from 'next-auth';
import Anthropic             from '@anthropic-ai/sdk';
import connectDB             from '@/lib/mongodb/connection';
import Trip                  from '@/lib/mongodb/models/Trip';
import User                  from '@/lib/mongodb/models/User';
import TripFile              from '@/lib/mongodb/models/TripFile';
import TripLogistics         from '@/lib/mongodb/models/TripLogistics';
import TripItinerary         from '@/lib/mongodb/models/TripItinerary';
import { MAX_TEXT_CHARS, CLAUDE_IMAGE_TYPES, fetchBinary, toClaudeInput, type Resolved } from '@/lib/extract/sources';
import { locateExtracted, type Locatable } from '@/lib/extract/locate';
import { resolveCheckIn, checkInHint } from '@/lib/itinerary/checkInTiming';
import { DOCUMENT_TYPE_VALUES, DOC_TYPE_EXTRACT } from '@/lib/files/documentTypes';
import { buildExistingIndex, describeExisting, flagDuplicates } from '@/lib/extract/existingMatch';
import { placeTz } from '@/lib/push/timezones';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(ctx: {
  tripName: string;
  city: string;
  country: string;
  tripDates: string;
  tz: string;
  userContext: string;
  sourceLabel: string;
  inlineText: string | null;
  fileTypeHint: string | null;
  fileTypeGuidance: string;
  existing: string;
}): string {
  return `You are extracting structured trip data from material a traveller collected for their trip. It could be a conference schedule, an itinerary, a booking confirmation, a hotel email, a spreadsheet, a photo of a printed programme, or free-form notes.

Context:
- Trip: ${ctx.tripName}
- Destination: ${ctx.city}, ${ctx.country}
- Trip dates: ${ctx.tripDates || 'unknown'}
- Local timezone: ${ctx.tz}
- Source: ${ctx.sourceLabel}
${ctx.userContext ? `- The traveller's own note about this: "${ctx.userContext}" — this is an instruction. Honour it: it may tell you which parts to keep or skip, whose booking this is, dates that apply, etc.` : ''}
${ctx.fileTypeHint ? `- The traveller has tagged this file as: "${ctx.fileTypeHint}" (${ctx.fileTypeGuidance}). Trust that unless the content clearly contradicts it.` : ''}
${ctx.existing ? `
Already in this trip (saved earlier, from another document or added by hand):
${ctx.existing}

Still extract everything in the material. On each item that is the same booking, place or scheduled event as a line above (even if this material words it differently) set "existingId" to that line's id. Same event means the same day at about the same time. Never set it just because two things share a venue, a day or a time slot; leave it null when unsure.
` : ''}
Extract everything relevant in these four groups:
1. Accommodation — hotels, guesthouses, apartments, any place to stay. Capture the check-in/check-out DATES and, if the material states them, the earliest check-in TIME and latest check-out TIME the property allows (e.g. "Check-in: from 15:00").
2. Venues — named places for events, concerts, conferences, meals (distinct from accommodation)
3. Itinerary stops — every scheduled session, concert, workshop, panel, meal, tour or activity that has a specific time
4. Transport — flights, trains, buses, ferries, transfers, booked car hire, booked airport parking

Rules:
- Dates: YYYY-MM-DD
- Times: HH:MM 24h
- scheduledStart / departureTime / arrivalTime: full ISO timestamp in ${ctx.tz}, e.g. "2026-07-22T20:00:00"
- itinerary "duration" is in minutes; estimate from an end time when given, otherwise use a sensible default for the activity type
- If a venue also hosts a scheduled item, list it once under venues AND include the scheduled item under itineraryStops
- Only include what is actually present in the material. Do not invent times or reference numbers. Omit a field rather than guess.
- "address": only a real street address if the material states one, else "". Never put just a city.
- "building": for a room, hall, stage, stand, booth or area INSIDE a larger venue, that venue's name — e.g. "Sala Sinfónica" → "Auditorio Alfredo Kraus", "Hall 9" → "NEC Birmingham". Use the event's main venue for its own rooms/stages/stands when the material or your knowledge of the event places them there. "" for a standalone place, or when you don't know.
- "to" / "toSearchQuery": only for an itinerary stop of type transport or transfer — where it goes (e.g. a bus "to Gare Rabat-Ville" → "Gare Rabat-Ville") and that place's search query in the same form as "searchQuery". Its own address/searchQuery is where it leaves from. "" when the material doesn't say, and for every other type.
- "searchQuery": ALWAYS provide one for accommodation, venues and itinerary stops — the real place's name (the building's, when "building" is set) followed by the actual town or city it is in and the country, e.g. "Sartory Hall, Cologne, Germany". Name the town, never just an island or region: "Las Palmas de Gran Canaria", not "Gran Canaria". The destination is ${ctx.city}, ${ctx.country} unless the material places it elsewhere.
- If the material contains none of a given group, return an empty array for it

DO NOT create:
- itinerary stops for hotel check-in or check-out — those are generated automatically from the accommodation dates and timed against the traveller's arrival flight. Just fill in the accommodation.
- transport for parking, WiFi or facilities AT an accommodation or venue — put those in that item's "notes". Only booked airport/station parking with its own location counts as transport.

Valid venue types: concert, conference, restaurant, sports, attraction, business, other
Valid itinerary stop types: flight, meeting, meal, breakfast, activity, sightseeing, transport, transfer, work, gig, other
Valid transport types: flight, train, bus, ferry, car, car_hire, taxi, private_transfer, parking

Also classify the whole document so the app knows where it belongs:
- "documentType": one of ${DOCUMENT_TYPE_VALUES.join(', ')}
  Notes: hotel_confirmation = any lodging (hotel, apartment, hostel, B&B, Booking.com/Airbnb). flight_booking = the reservation/e-ticket you get when booking; boarding_pass = the day-of-travel pass with a gate & seat. trip_itinerary = a whole-trip plan covering several bookings. If it is a personal/admin document (passport, visa, ESTA/eTA/ETIAS, insurance, vaccination cert, medical letter, driving permit, invitation letter, receipt, travel approval) pick that type and return EMPTY arrays for all four groups unless the document also plainly contains a booking.
- "summary": ONE plain sentence a traveller would understand, e.g. "Booking.com confirmation — Hotel Mondial, Cologne, check-in 24 Sep, check-out 27 Sep, ref XYZ123". If it is not a real trip document, say so.

Return ONLY valid JSON, no markdown, no commentary:

{
  "documentType": "hotel_confirmation",
  "summary": "one plain sentence",
  "accommodation": [
    { "type": "hotel", "name": "...", "address": "...", "searchQuery": "Hotel name, Town, Country", "checkIn": "YYYY-MM-DD or null", "checkOut": "YYYY-MM-DD or null", "checkInTime": "HH:MM or null", "checkOutTime": "HH:MM or null", "confirmationNumber": "... or null", "notes": "...", "existingId": "a0 or null" }
  ],
  "venues": [
    { "type": "concert", "name": "...", "address": "...", "building": "... or empty", "searchQuery": "Venue name, Town, Country", "date": "YYYY-MM-DD or null", "time": "HH:MM or null", "notes": "...", "existingId": "v0 or null" }
  ],
  "itineraryStops": [
    { "name": "...", "type": "meeting", "date": "YYYY-MM-DD", "scheduledStart": "2026-07-22T14:30:00", "duration": 90, "address": "...", "building": "... or empty", "searchQuery": "Place name, Town, Country", "to": "... or empty", "toSearchQuery": "... or empty", "notes": "...", "existingId": "s0 or null" }
  ],
  "transport": [
    { "type": "flight", "departureLocation": "...", "arrivalLocation": "...", "departureTime": "2026-07-22T09:00:00 or null", "arrivalTime": "2026-07-22T11:30:00 or null", "confirmationNumber": "... or null", "flightNumber": "... or null", "operator": "... or null", "notes": "...", "existingId": "t0 or null" }
  ]
}
${ctx.inlineText ? `\nMATERIAL:\n"""\n${ctx.inlineText}\n"""` : ''}`;
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Body (any one of):
//   { text, context? }                    — pasted text / a note's body
//   { fileId, context? }                  — an existing TripFile (file or note)
//   { gcsUrl, mimeType?, context? }       — a raw stored file (back-compat)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body: {
    text?: string; fileId?: string; gcsUrl?: string; mimeType?: string; context?: string; fileType?: string;
  } = await req.json().catch(() => ({}));

  let userContext    = (body.context ?? '').trim().slice(0, 500);
  const fileTypeHint = (body.fileType && body.fileType !== 'other') ? body.fileType : null;
  const EXTRACT_GUIDANCE: Record<string, string> = {
    transport:     'its contents are a booked journey — extract it under transport',
    accommodation: 'its contents are a place to stay — extract it under accommodation',
    events:        'its contents are a scheduled event or activity — extract it as a venue and/or itinerary stop',
    everything:    'it may cover the whole trip — extract accommodation, venues, itinerary stops and transport',
    reference:     'it is a personal/admin document — extract NOTHING unless it plainly also contains a booking',
  };
  const fileTypeGuidance = fileTypeHint
    ? (EXTRACT_GUIDANCE[DOC_TYPE_EXTRACT[fileTypeHint] ?? 'everything'] ?? '')
    : '';

  // ── Resolve the source ──────────────────────────────────────────────────────
  let resolved: Resolved;
  try {
    if (body.text?.trim()) {
      resolved = { kind: 'text', text: body.text.trim().slice(0, MAX_TEXT_CHARS), label: 'pasted text' };
    } else if (body.fileId) {
      const doc = await TripFile.findOne({ _id: body.fileId, tripId: id });
      if (!doc) return NextResponse.json({ error: 'File not found' }, { status: 404 });

      // The note the traveller typed on the file is context for the AI.
      if (!userContext && doc.notes?.trim()) userContext = doc.notes.trim().slice(0, 500);

      if (doc.resourceType === 'note') {
        const noteText = [doc.name, doc.body].filter(Boolean).join('\n\n');
        if (!noteText.trim()) return NextResponse.json({ error: 'That note is empty' }, { status: 400 });
        resolved = { kind: 'text', text: noteText.slice(0, MAX_TEXT_CHARS), label: `note "${doc.name || 'untitled'}"` };
      } else if (doc.gcsUrl) {
        resolved = await fetchBinary(doc.gcsUrl, doc.mimeType ?? undefined, doc.name || 'document');
      } else {
        return NextResponse.json({ error: 'That resource has no file to read' }, { status: 400 });
      }
    } else if (body.gcsUrl) {
      resolved = await fetchBinary(body.gcsUrl, body.mimeType);
    } else {
      return NextResponse.json({ error: 'Nothing to analyse — pass text, a fileId, or a gcsUrl' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not read that source' }, { status: 400 });
  }

  // ── Normalise to something Claude can read ──────────────────────────────────
  let claudeInput: Resolved;
  try {
    claudeInput = await toClaudeInput(resolved);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not read that file' }, { status: 400 });
  }

  const tripDates = [
    trip.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : null,
    trip.endDate   ? new Date(trip.endDate).toISOString().split('T')[0]   : null,
  ].filter(Boolean).join(' to ');

  // What's already saved, so a second schedule for the same event isn't imported twice.
  const [logistics, itinerary] = await Promise.all([
    TripLogistics.findOne({ tripId: id }).lean() as Promise<any>,
    TripItinerary.findOne({ tripId: id }).lean() as Promise<any>,
  ]);
  const existing = buildExistingIndex(logistics, itinerary);

  const prompt = buildPrompt({
    tripName:    trip.name,
    city:        trip.destination?.city    ?? '',
    country:     trip.destination?.country ?? '',
    tripDates,
    tz:          placeTz(trip.destination) ?? 'UTC',
    userContext,
    sourceLabel: claudeInput.label,
    inlineText:  claudeInput.kind === 'text' ? claudeInput.text : null,
    fileTypeHint,
    fileTypeGuidance,
    existing:    describeExisting(existing),
  });

  // ── Build the message content ──────────────────────────────────────────────
  const content: any[] = [];
  let betaHeaders: Record<string, string> | undefined;

  if (claudeInput.kind === 'binary') {
    if (claudeInput.mimeType === 'application/pdf') {
      content.push({
        type:   'document',
        source: { type: 'base64', media_type: 'application/pdf', data: claudeInput.buffer.toString('base64') },
      });
      betaHeaders = { 'anthropic-beta': 'pdfs-2024-09-25' };
    } else if (CLAUDE_IMAGE_TYPES.has(claudeInput.mimeType)) {
      content.push({
        type:   'image',
        source: { type: 'base64', media_type: claudeInput.mimeType, data: claudeInput.buffer.toString('base64') },
      });
    }
  }
  content.push({ type: 'text', text: prompt });

  try {
    const msg = await anthropic.messages.create(
      {
        model:      'claude-sonnet-4-6',
        max_tokens: 8192,
        messages:   [{ role: 'user', content }],
      },
      betaHeaders ? { headers: betaHeaders } : undefined,
    );

    const raw = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('analyze-document: no JSON in response:', raw.slice(0, 400));
      return NextResponse.json({ error: 'The AI returned an unexpected response. Please try again.' }, { status: 502 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const VALID_DOC_TYPES = new Set(DOCUMENT_TYPE_VALUES);
    const classification = {
      documentType: VALID_DOC_TYPES.has(parsed.documentType) ? parsed.documentType : (fileTypeHint ?? 'other'),
      summary:      typeof parsed.summary === 'string' ? parsed.summary.slice(0, 300) : '',
    };

    const extracted = {
      accommodation:  Array.isArray(parsed.accommodation)  ? parsed.accommodation  : [],
      venues:         Array.isArray(parsed.venues)         ? parsed.venues         : [],
      itineraryStops: Array.isArray(parsed.itineraryStops) ? parsed.itineraryStops : [],
      transport:      Array.isArray(parsed.transport)      ? parsed.transport      : [],
    };

    // Check-in / check-out stops are derived from the accommodation (and timed
    // against the arrival flight) — never take the AI's version.
    extracted.itineraryStops = extracted.itineraryStops.filter((s: any) => {
      const t = String(s?.type || '').toLowerCase().replace(/[^a-z]/g, '');
      const n = String(s?.name || '').toLowerCase();
      return t !== 'checkin' && t !== 'checkout' && !/\bcheck[\s-]?(in|out)\b/.test(n);
    });
    // Drop "transport" that isn't a journey (on-site parking, same place → same place).
    extracted.transport = extracted.transport.filter((t: any) => {
      const dep = String(t?.departureLocation || '').trim().toLowerCase();
      const arr = String(t?.arrivalLocation   || '').trim().toLowerCase();
      return !(dep && arr && dep === arr);
    });

    flagDuplicates(extracted, existing);

    // Where a transport stop goes — located like any other place
    const destinations: Array<{ stop: any; place: Locatable }> = [];
    for (const s of extracted.itineraryStops) {
      const to = typeof s?.to === 'string' ? s.to.trim() : '';
      if (to && (s.type === 'transport' || s.type === 'transfer')) {
        destinations.push({ stop: s, place: { name: to, searchQuery: typeof s.toSearchQuery === 'string' ? s.toSearchQuery : undefined } });
      }
      delete s.to;
      delete s.toSearchQuery;
    }

    // ── Resolve real addresses + coordinates (see locateExtracted) ───────────
    await locateExtracted(
      [...extracted.accommodation, ...extracted.venues, ...extracted.itineraryStops, ...destinations.map(d => d.place)],
      trip, logistics,
    );
    for (const { stop, place } of destinations) {
      stop.to = { name: place.name, ...(place.address && { address: place.address }), ...(place.coordinates && { coordinates: place.coordinates }) };
    }

    // ── Preview the check-in time against the trip's inbound flights ──────────
    if (extracted.accommodation.length) {
      const arrivals: (string | null)[] = (logistics?.transportation ?? []).map((t: any) => t.arrivalTime ?? null);
      for (const a of extracted.accommodation) {
        if (!a.checkIn) continue;
        const res = resolveCheckIn({
          checkInDate: String(a.checkIn).split('T')[0],
          propertyCheckInTime: a.checkInTime,
          arrivals,
        });
        a.resolvedCheckInTime = res.time;
        a.checkInHint = checkInHint(res);
      }
    }

    return NextResponse.json({ extracted, classification });
  } catch (err: any) {
    console.error('Document analysis error:', err);
    return NextResponse.json({ error: 'Failed to analyse that source' }, { status: 500 });
  }
}
