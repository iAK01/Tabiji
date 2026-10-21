import { NextResponse }     from 'next/server';
import { getServerSession }  from 'next-auth';
import Anthropic             from '@anthropic-ai/sdk';
import mammoth               from 'mammoth';
import * as XLSX             from 'xlsx';
import connectDB             from '@/lib/mongodb/connection';
import Trip                  from '@/lib/mongodb/models/Trip';
import User                  from '@/lib/mongodb/models/User';
import TripFile              from '@/lib/mongodb/models/TripFile';
import TripLogistics         from '@/lib/mongodb/models/TripLogistics';
import TripItinerary         from '@/lib/mongodb/models/TripItinerary';
import { locatePlace, localityWords, sameName } from '@/lib/geo/geocode';
import { resolveCheckIn, checkInHint } from '@/lib/itinerary/checkInTiming';
import { DOCUMENT_TYPE_VALUES, DOC_TYPE_EXTRACT } from '@/lib/files/documentTypes';
import { buildExistingIndex, describeExisting, flagDuplicates } from '@/lib/extract/existingMatch';
import { placeTz } from '@/lib/push/timezones';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TEXT_CHARS = 200_000;
const CLAUDE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// ─── Source resolution ────────────────────────────────────────────────────────
// The client can point us at anything: an uploaded file, a raw GCS url, a saved
// note, or a blob of pasted text. Everything below normalises to either a
// { kind: 'text' } or a { kind: 'binary' } shape that we can hand to Claude.

type Resolved =
  | { kind: 'text'; text: string; label: string }
  | { kind: 'binary'; buffer: Buffer; mimeType: string; label: string };

function mimeFromName(name: string): string | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    jpg:  'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:  'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls:  'application/vnd.ms-excel',
    csv:  'text/csv',
    txt:  'text/plain',
    md:   'text/plain',
  };
  return map[ext] ?? null;
}

async function fetchBinary(url: string, mimeHint?: string, label = 'document'): Promise<Resolved> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch the file (${res.status})`);
  const buffer   = Buffer.from(await res.arrayBuffer());
  const mimeType = mimeHint
    ?? res.headers.get('content-type')?.split(';')[0]?.trim()
    ?? mimeFromName(url)
    ?? 'application/octet-stream';
  return { kind: 'binary', buffer, mimeType, label };
}

// Turn a resolved binary into text where Claude can't read the format natively.
async function toClaudeInput(r: Resolved): Promise<Resolved> {
  if (r.kind === 'text') return r;

  const { mimeType, buffer, label } = r;

  if (mimeType === 'application/pdf' || CLAUDE_IMAGE_TYPES.has(mimeType)) return r;

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    throw new Error('HEIC images can’t be read directly — take a screenshot or convert it to JPEG first.');
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return { kind: 'text', text: value.slice(0, MAX_TEXT_CHARS), label };
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const text = wb.SheetNames
      .map(name => `### Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`)
      .join('\n\n')
      .slice(0, MAX_TEXT_CHARS);
    return { kind: 'text', text, label };
  }

  if (mimeType === 'text/csv' || mimeType.startsWith('text/')) {
    return { kind: 'text', text: buffer.toString('utf-8').slice(0, MAX_TEXT_CHARS), label };
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

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
    { "name": "...", "type": "meeting", "date": "YYYY-MM-DD", "scheduledStart": "2026-07-22T14:30:00", "duration": 90, "address": "...", "building": "... or empty", "searchQuery": "Place name, Town, Country", "notes": "...", "existingId": "s0 or null" }
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

    // ── Resolve real addresses + coordinates ─────────────────────────────────
    // People walk to these pins. A place gets coordinates only when the lookup
    // finds that exact place (see locatePlace); otherwise it's flagged, never guessed.
    // A room/stage/stand is located by its building, and reuses a pin the trip
    // already has for that building rather than looking it up again.
    const dest = trip.destination?.coordinates;
    if (dest?.lat && dest?.lng) {
      const locality = [trip.destination?.city, trip.destination?.country].filter(Boolean).join(', ');
      const area     = { center: { lat: dest.lat, lng: dest.lng }, locality, maxKm: 40 };
      const words    = localityWords(locality);
      const norm     = (s: string) => s.trim().toLowerCase();
      const pinned   = [...(logistics?.venues ?? []), ...(logistics?.accommodation ?? [])]
        .filter((k: any) => k?.name && k.coordinates?.lat);
      // Dozens of sessions share a handful of rooms — one lookup per distinct place.
      const lookups = new Map<string, ReturnType<typeof locatePlace>>();

      const locate = async (item: any) => {
        const building = String(item.building ?? '').trim();
        const name     = building || String(item.name ?? '').trim();
        const known    = pinned.find((k: any) => norm(k.name) === norm(name) || sameName(name, k.name, words));
        const hit      = known
          ? { address: known.address || item.address, lat: known.coordinates.lat, lng: known.coordinates.lng }
          : await (() => {
              const key = [name, item.searchQuery, item.address].map(v => norm(String(v ?? ''))).join('|');
              if (!lookups.has(key)) lookups.set(key, locatePlace({ name, query: item.searchQuery, address: item.address }, area));
              return lookups.get(key)!;
            })();
        if (hit) {
          item.address     = hit.address;
          item.coordinates = { lat: hit.lat, lng: hit.lng };
        } else if (!item.address?.trim()) {
          item.addressUnverified = true;
        }
        delete item.searchQuery;
        delete item.building;
        return item;
      };

      await Promise.all([
        ...extracted.accommodation.map(locate),
        ...extracted.venues.map(locate),
        ...extracted.itineraryStops.map(locate),
      ]);
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
