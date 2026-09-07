import { NextResponse }     from 'next/server';
import { getServerSession }  from 'next-auth';
import Anthropic             from '@anthropic-ai/sdk';
import mammoth               from 'mammoth';
import * as XLSX             from 'xlsx';
import connectDB             from '@/lib/mongodb/connection';
import Trip                  from '@/lib/mongodb/models/Trip';
import User                  from '@/lib/mongodb/models/User';
import TripFile              from '@/lib/mongodb/models/TripFile';

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
}): string {
  return `You are extracting structured trip data from material a traveller collected for their trip. It could be a conference schedule, an itinerary, a booking confirmation, a hotel email, a spreadsheet, a photo of a printed programme, or free-form notes.

Context:
- Trip: ${ctx.tripName}
- Destination: ${ctx.city}, ${ctx.country}
- Trip dates: ${ctx.tripDates || 'unknown'}
- Local timezone: ${ctx.tz}
- Source: ${ctx.sourceLabel}
${ctx.userContext ? `- The traveller describes this material as: "${ctx.userContext}"` : ''}

Extract everything relevant in these four groups:
1. Accommodation — hotels, guesthouses, apartments, any place to stay
2. Venues — named places for events, concerts, conferences, meals (distinct from accommodation)
3. Itinerary stops — every scheduled session, concert, workshop, panel, meal, tour or activity that has a specific time
4. Transport — flights, trains, buses, ferries, transfers, car hire, parking

Rules:
- Dates: YYYY-MM-DD
- Times: HH:MM 24h
- scheduledStart / departureTime / arrivalTime: full ISO timestamp in ${ctx.tz}, e.g. "2026-07-22T20:00:00"
- itinerary "duration" is in minutes; estimate from an end time when given, otherwise use a sensible default for the activity type
- If a venue also hosts a scheduled item, list it once under venues AND include the scheduled item under itineraryStops
- Only include what is actually present in the material. Do not invent times, addresses or reference numbers. Omit a field rather than guess.
- If the material contains none of a given group, return an empty array for it

Valid venue types: concert, conference, restaurant, sports, attraction, business, other
Valid itinerary stop types: flight, hotel, meeting, meal, breakfast, activity, sightseeing, transport, transfer, checkin, work, gig, other
Valid transport types: flight, train, bus, ferry, car, car_hire, taxi, private_transfer, parking

Return ONLY valid JSON, no markdown, no commentary:

{
  "accommodation": [
    { "type": "hotel", "name": "...", "address": "...", "notes": "..." }
  ],
  "venues": [
    { "type": "concert", "name": "...", "address": "...", "date": "YYYY-MM-DD or null", "time": "HH:MM or null", "notes": "..." }
  ],
  "itineraryStops": [
    { "name": "...", "type": "meeting", "date": "YYYY-MM-DD", "scheduledStart": "2026-07-22T14:30:00", "duration": 90, "address": "...", "notes": "..." }
  ],
  "transport": [
    { "type": "flight", "departureLocation": "...", "arrivalLocation": "...", "departureTime": "2026-07-22T09:00:00 or null", "arrivalTime": "2026-07-22T11:30:00 or null", "confirmationNumber": "... or null", "flightNumber": "... or null", "operator": "... or null", "notes": "..." }
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
    text?: string; fileId?: string; gcsUrl?: string; mimeType?: string; context?: string;
  } = await req.json().catch(() => ({}));

  const userContext = (body.context ?? '').trim().slice(0, 500);

  // ── Resolve the source ──────────────────────────────────────────────────────
  let resolved: Resolved;
  try {
    if (body.text?.trim()) {
      resolved = { kind: 'text', text: body.text.trim().slice(0, MAX_TEXT_CHARS), label: 'pasted text' };
    } else if (body.fileId) {
      const doc = await TripFile.findOne({ _id: body.fileId, tripId: id });
      if (!doc) return NextResponse.json({ error: 'File not found' }, { status: 404 });

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

  const prompt = buildPrompt({
    tripName:    trip.name,
    city:        trip.destination?.city    ?? '',
    country:     trip.destination?.country ?? '',
    tripDates,
    tz:          trip.destination?.timezone ?? 'UTC',
    userContext,
    sourceLabel: claudeInput.label,
    inlineText:  claudeInput.kind === 'text' ? claudeInput.text : null,
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
    const extracted = {
      accommodation:  Array.isArray(parsed.accommodation)  ? parsed.accommodation  : [],
      venues:         Array.isArray(parsed.venues)         ? parsed.venues         : [],
      itineraryStops: Array.isArray(parsed.itineraryStops) ? parsed.itineraryStops : [],
      transport:      Array.isArray(parsed.transport)      ? parsed.transport      : [],
    };

    return NextResponse.json({ extracted });
  } catch (err: any) {
    console.error('Document analysis error:', err);
    return NextResponse.json({ error: 'Failed to analyse that source' }, { status: 500 });
  }
}
