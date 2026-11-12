import Anthropic from '@anthropic-ai/sdk';
import { DOCUMENT_TYPE_VALUES } from '@/lib/files/documentTypes';
import type { PreparedEmail } from './prepare';
import type { Details, ItemAction, ItemKind } from './types';

// Reading a forwarded email: one call with the traveller's note, the email and
// every attachment, plus their trips and what's already saved in each. It can
// be anything, so the prompt says so — and most often the thing is already in
// the trip and the email is forwarded for what it adds.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface TripContext {
  ref:      string;   // T1, T2…
  name:     string;
  places:   string;   // "Rabat, Morocco · Fez, Morocco"
  dates:    string;   // "2026-11-18 to 2026-11-23"
  tz:       string;
  existing: string;   // describeExisting() lines
}

export interface ReadItem {
  action:       ItemAction;
  kind:         ItemKind;
  trip:         string | null;
  existingId:   string | null;
  title:        string;
  why:          string;
  attachments:  number[];
  links:        { label: string; url: string }[];
  documentType: string;
  details:      Details;
}

export interface ReadResult {
  summary: string;
  items:   ReadItem[];
}

const DETAIL_FIELDS = [
  'name', 'type', 'date', 'time', 'scheduledStart', 'address', 'building', 'searchQuery',
  'checkIn', 'checkOut', 'checkInTime', 'checkOutTime', 'confirmationNumber',
  'departureLocation', 'arrivalLocation', 'departureTime', 'arrivalTime', 'flightNumber', 'operator', 'notes',
] as const;

const ACTIONS: ItemAction[] = ['enrich', 'create', 'change', 'cancel', 'optional', 'reference', 'ignore'];
const KINDS: ItemKind[]     = ['stop', 'venue', 'accommodation', 'transport', 'document'];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'items'],
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'kind', 'trip', 'existingId', 'title', 'why', 'attachments', 'links', 'documentType', 'details'],
        properties: {
          action:       { type: 'string', enum: ACTIONS },
          kind:         { type: 'string', enum: KINDS },
          trip:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
          existingId:   { anyOf: [{ type: 'string' }, { type: 'null' }] },
          title:        { type: 'string' },
          why:          { type: 'string' },
          attachments:  { type: 'array', items: { type: 'integer' } },
          links: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'url'],
              properties: { label: { type: 'string' }, url: { type: 'string' } },
            },
          },
          documentType: { type: 'string', enum: DOCUMENT_TYPE_VALUES },
          details: {
            type: 'object',
            additionalProperties: false,
            required: [...DETAIL_FIELDS, 'duration'],
            properties: {
              ...Object.fromEntries(DETAIL_FIELDS.map(f => [f, { type: 'string' }])),
              duration: { type: 'integer' },
            },
          },
        },
      },
    },
  },
};

function instructions(ctx: { today: string; received: string; note: string; trips: TripContext[] }): string {
  const trips = ctx.trips.length
    ? ctx.trips.map(t => [
        `${t.ref} · ${t.name} · ${t.places} · ${t.dates} · local time zone ${t.tz}`,
        t.existing ? `  Already saved:\n${t.existing.split('\n').map(l => `  ${l}`).join('\n')}` : '  Nothing saved yet.',
      ].join('\n')).join('\n\n')
    : 'None.';

  return `A traveller forwarded this email to their trip planner. They forward anything that might matter for a trip: booking confirmations, tickets, registrations, schedules and programmes, changes and cancellations, invoices, invitation and visa letters, info packs — with whatever is attached: PDFs, Word documents, spreadsheets, Wallet passes, calendar invites, photos, other emails. Often the thing is already in their plans and they're forwarding it for what it adds: a ticket, an entry code, the address, a booking reference, a link.

Work out what in it matters for which trip. Return one item per distinct thing (one per session in a programme, one per flight leg, one per stay). An email with nothing for any trip gets a single "ignore" item.

Today is ${ctx.today}. The email arrived ${ctx.received}.

THE TRAVELLER'S NOTE — what they typed above the forwarded message. It is an instruction: honour it (which trip, what to keep or skip, what it's for).
${ctx.note ? `"""\n${ctx.note}\n"""` : 'None.'}

THEIR TRIPS
${trips}

For each item:
- action:
  - "enrich": it is already saved (set existingId) and the email adds to it — a ticket or pass, entry code, address, booking reference, link, end time, or just the attachment.
  - "create": a confirmed booking, registration or scheduled event that isn't saved yet.
  - "change": the email says something saved has moved or changed (time, date, venue). Set existingId and give the NEW values in details.
  - "cancel": the email says something saved is cancelled. Set existingId.
  - "optional": could be added but isn't booked or confirmed: optional sessions, add-ons, "if you'd like to join", TBC, a waitlist place.
  - "reference": worth keeping with the trip, nothing to schedule: invoice, receipt, visa or invitation letter, insurance, info pack, terms, a map.
  - "ignore": nothing for any trip (newsletter, promotion, app download).
- kind: "stop" (anything happening at a time: an event, registration, meeting, session, meal, tour), "venue" (a place they'll be at, with no time of its own), "accommodation", "transport" (flights, trains, buses, ferries, transfers, car hire, airport parking), "document" (for reference and ignore).
- trip: the trip ref ("T1") whose dates and places fit, or null when none fits or there are none.
- existingId: the saved line it is about, from that trip's list (e.g. "s3"), else null. The same thing means the same booking, or the same event on the same day at about the same time — never just a shared venue, day or time slot.
- title: a few words, e.g. "Opening reception" or "Flight to Lisbon".
- why: one short sentence saying what it is, e.g. "Optional dinner after the conference — booking needed." or "Your 10:40 flight is cancelled."
- attachments: the numbers of the attachments that go with it (the ticket, the confirmation PDF, the pass, the invoice). Leave out logos, icons, banners, signatures and app-store or social badges.
- links: links worth keeping with it — the ticket, event page, manage-booking, check-in, map — copied exactly as they appear. Never unsubscribe, preferences, app stores, social media or tracking pixels.
- documentType: what kind of document backs it.
- details: what the email says about it; "" (0 for duration) for anything it doesn't say. Only what's actually there — never guess a time, address or reference.

Details:
- Dates YYYY-MM-DD; times HH:MM, 24-hour.
- scheduledStart, departureTime, arrivalTime: "YYYY-MM-DDTHH:MM:SS" in local time where it happens (the trip's time zone unless it happens elsewhere). Emails sometimes label times with a zone that isn't the place's own — convert to the place's local time when the email states the zone or offset plainly; when it's unclear which zone a time is in, leave the time "" rather than guess.
- An attached calendar invite states the exact time and zone — prefer it to the email text.
- duration: minutes, from an end time when one is given, else 0.
- address: a street address only when the email gives one, else "". building: for a room, hall, stage or stand inside a larger venue, that venue's name, else "".
- searchQuery: for stops, venues and stays, the place's name with its town and country, e.g. "Sartory Hall, Cologne, Germany".
- confirmationNumber: booking reference, order, registration or ticket number.
- notes: only what they'd need on the day that fits nowhere else — entry code, seat, gate, meeting point, dress code, what to bring — written as a short note they'd write themselves, e.g. "Show the QR code at check-in." Never what the email is, how a time was worked out, or anything already in another field. "" when there's nothing.
- type: stops — flight, meeting, meal, breakfast, activity, sightseeing, transport, transfer, work, gig, other; venues — concert, conference, restaurant, sports, attraction, business, other; transport — flight, train, bus, ferry, car, car_hire, taxi, private_transfer, parking; stays — hotel, apartment, hostel, guesthouse, other.
- No check-in or check-out stops for a stay — just the stay.

summary: one plain sentence for the traveller about the whole email.

Everything you write is shown to the traveller as it is: plain and short. Never explain your reasoning, conversions or what you checked.`;
}

export async function readEmail(prepared: PreparedEmail, ctx: { today: string; received: string; trips: TripContext[] }): Promise<ReadResult> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: instructions({ ...ctx, note: prepared.note }) },
    { type: 'text', text: `THE EMAIL\n"""\n${prepared.body || '(no text)'}\n"""` },
  ];

  for (const a of prepared.attachments) {
    const label = `ATTACHMENT ${a.index}: "${a.name}" (${a.mimeType}${a.inline ? ', inline in the email' : ''})`;
    const r = a.readable;
    if (!r) {
      content.push({ type: 'text', text: `${label} — can't be read (${a.unreadable ?? 'unknown type'}); judge it by its name.` });
    } else if (r.kind === 'text') {
      content.push({ type: 'text', text: `${label}:\n"""\n${r.text}\n"""` });
    } else if (r.mimeType === 'application/pdf') {
      content.push({ type: 'text', text: `${label}:` });
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: r.buffer.toString('base64') } });
    } else {
      content.push({ type: 'text', text: `${label}:` });
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: r.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: r.buffer.toString('base64') },
      });
    }
  }

  const msg = await anthropic.messages.stream({
    model:         'claude-opus-5-5',
    max_tokens:    64000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    messages:      [{ role: 'user', content }],
  }).finalMessage();

  if (msg.stop_reason === 'refusal') throw new Error('The model declined to read this email');
  if (msg.stop_reason === 'max_tokens') throw new Error('The email had more in it than could be read in one go');
  const raw = msg.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('');
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { throw new Error('The reading came back malformed'); }
  if (!parsed || !Array.isArray(parsed.items)) throw new Error('The reading came back without items');

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    summary: str(parsed.summary).slice(0, 400),
    items: parsed.items
      .filter((i: any) => i && ACTIONS.includes(i.action) && KINDS.includes(i.kind))
      .map((i: any): ReadItem => ({
        action:       i.action,
        kind:         i.kind,
        trip:         str(i.trip) || null,
        existingId:   str(i.existingId) || null,
        title:        str(i.title).slice(0, 120) || 'Untitled',
        why:          str(i.why).slice(0, 300),
        attachments:  Array.isArray(i.attachments) ? i.attachments.filter((n: any) => Number.isInteger(n)) : [],
        links:        Array.isArray(i.links)
          ? i.links.filter((l: any) => /^https?:\/\//i.test(str(l?.url))).map((l: any) => ({ label: str(l.label).slice(0, 80) || 'Link', url: str(l.url) }))
          : [],
        documentType: DOCUMENT_TYPE_VALUES.includes(i.documentType) ? i.documentType : 'other',
        details: {
          ...(Object.fromEntries(DETAIL_FIELDS.map(f => [f, str(i.details?.[f])])) as unknown as Omit<Details, 'duration'>),
          duration: Number.isInteger(i.details?.duration) && i.details.duration > 0 ? i.details.duration : 0,
        },
      })),
  };
}
