// "Is this already in the trip?" for Smart Extract.
//
// A second schedule for the same event (the official programme, then the tour
// company's version) would otherwise import everything twice. We index what's
// already saved, show it to the AI so it can flag same-thing-different-words
// matches, and back that up with plain rules (flight number, booking ref, same
// time + similar name). Matches come back flagged and pre-unticked — the
// traveller can still add them.

export interface DuplicateOf {
  label: string;
  date?: string;  // YYYY-MM-DD
  time?: string;  // HH:MM
}

type Kind = 'transport' | 'accommodation' | 'venue' | 'stop';

interface Existing {
  id:        string;          // short ref the AI sees: t0, a0, v0, s0
  kind:      Kind;
  label:     string;
  date?:     string;
  end?:      string;          // accommodation check-out
  time?:     string;
  tokens:    Set<string>;
  flight?:   string;
  ref?:      string;
  mode?:     string;          // transport type
  mirrored?: boolean;         // itinerary stop generated from logistics
}

export type ExistingIndex = Existing[];

// ─── Normalisers ──────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'of', 'at', 'in', 'on', 'to', 'for', 'with', 'by', 'from',
  'de', 'la', 'le', 'les', 'du', 'der', 'die', 'das', 'und', 'het', 'el', 'il',
]);

function ymd(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

// Only from strings — a bare Date has no trustworthy local time here.
function hm(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.match(/(?:^|T)(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
}

function minutes(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function tokens(s: unknown): Set<string> {
  return new Set(
    String(s ?? '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w && !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w))),
  );
}

function ref(v: unknown): string | undefined {
  const r = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return r.length >= 4 ? r : undefined;
}

// "EI 0123" and "EI123" are the same flight.
function flightNo(v: unknown): string | undefined {
  const r = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = r.match(/^([A-Z0-9]{2})0*(\d{1,4}[A-Z]?)$/);
  return m ? m[1] + m[2] : undefined;
}

// ─── Comparisons ──────────────────────────────────────────────────────────────

/** Same name in different words: most words shared, or every word of the shorter one. */
function sameName(a: Set<string>, b: Set<string>, strict = false): boolean {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  if (!shared) return false;
  const dice = (2 * shared) / (a.size + b.size);
  return strict ? dice >= 0.8 : dice >= 0.6 || shared === Math.min(a.size, b.size);
}

function sameDay(a?: string, b?: string): boolean {
  return !a || !b || a === b;
}

function near(a: string | undefined, b: string | undefined, within: number): boolean {
  const x = minutes(a), y = minutes(b);
  return x == null || y == null || Math.abs(x - y) <= within;
}

function overlaps(aIn?: string, aOut?: string, bIn?: string, bOut?: string): boolean {
  if (!aIn || !bIn) return true;
  return aIn <= (bOut ?? bIn) && bIn <= (aOut ?? aIn);
}

// ─── Index ────────────────────────────────────────────────────────────────────

export function buildExistingIndex(logistics: any, itinerary: any): ExistingIndex {
  const items: Existing[] = [];

  (logistics?.transportation ?? []).forEach((t: any, i: number) => {
    if (!t) return;
    const flight = flightNo(t.details?.flightNumber ?? t.flightNumber);
    const route  = [t.departureLocation, t.arrivalLocation].filter(Boolean).join(' → ');
    items.push({
      id: `t${i}`, kind: 'transport',
      label: [flight ?? t.details?.operator ?? t.details?.airline ?? t.type, route].filter(Boolean).join(' · '),
      date: ymd(t.departureTime), time: hm(t.departureTime),
      tokens: tokens(route), flight, ref: ref(t.confirmationNumber), mode: t.type,
    });
  });

  (logistics?.accommodation ?? []).forEach((a: any, i: number) => {
    if (!a?.name) return;
    items.push({
      id: `a${i}`, kind: 'accommodation', label: a.name,
      date: ymd(a.checkIn), end: ymd(a.checkOut),
      tokens: tokens(a.name), ref: ref(a.confirmationNumber),
    });
  });

  (logistics?.venues ?? []).forEach((v: any, i: number) => {
    if (!v?.name) return;
    items.push({
      id: `v${i}`, kind: 'venue', label: v.name,
      date: ymd(v.date), time: hm(v.time), tokens: tokens(v.name),
    });
  });

  let n = 0;
  for (const day of itinerary?.days ?? []) {
    const date = ymd(day?.date);
    for (const s of day?.stops ?? []) {
      if (!s?.name) continue;
      items.push({
        id: `s${n++}`, kind: 'stop', label: s.name,
        date, time: hm(s.scheduledStart) ?? hm(s.time), tokens: tokens(s.name),
        mirrored: s.source === 'logistics',
      });
    }
  }

  return items;
}

const KIND_LABEL: Record<Kind, string> = {
  transport: 'transport', accommodation: 'stay', venue: 'venue', stop: 'schedule',
};

/** One line per saved item for the prompt. Mirrored stops are covered by their t/a/v line. */
export function describeExisting(index: ExistingIndex, max = 400): string {
  return index
    .filter(e => !e.mirrored)
    .slice(0, max)
    .map(e => {
      const when = e.kind === 'accommodation'
        ? [e.date, e.end].filter(Boolean).join(' → ')
        : [e.date, e.time].filter(Boolean).join(' ');
      return `${e.id} · ${KIND_LABEL[e.kind]} · ${e.label}${when ? ` · ${when}` : ''}`;
    })
    .join('\n');
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/** Does the AI's existingId hold up against the dates and times? */
function confirmsAi(kind: Kind, item: any, e: Existing): boolean {
  switch (kind) {
    case 'transport':
      return e.kind === 'transport' && sameDay(ymd(item.departureTime), e.date);
    case 'accommodation':
      return e.kind === 'accommodation' && overlaps(ymd(item.checkIn), ymd(item.checkOut), e.date, e.end);
    case 'venue':
      return e.kind === 'venue' && sameDay(ymd(item.date), e.date);
    case 'stop': {
      if (e.kind === 'accommodation') return false;
      const date = ymd(item.date) ?? ymd(item.scheduledStart);
      return sameDay(date, e.date) && near(hm(item.scheduledStart), e.time, 90);
    }
  }
}

function ruleMatch(kind: Kind, item: any, index: ExistingIndex): Existing | undefined {
  switch (kind) {
    case 'transport': {
      const flight = flightNo(item.flightNumber);
      const r      = ref(item.confirmationNumber);
      const date   = ymd(item.departureTime);
      const time   = hm(item.departureTime);
      return index.find(e => e.kind === 'transport' && (
        (flight && e.flight === flight && sameDay(date, e.date)) ||
        // One booking ref often covers outbound and return — needs the same day too
        (r && e.ref === r && date && date === e.date) ||
        (item.type === e.mode && date && date === e.date && time && e.time && near(time, e.time, 20))
      ));
    }
    case 'accommodation': {
      const r = ref(item.confirmationNumber);
      const t = tokens(item.name);
      return index.find(e => e.kind === 'accommodation' && (
        (r && e.ref === r) ||
        (sameName(t, e.tokens) && overlaps(ymd(item.checkIn), ymd(item.checkOut), e.date, e.end))
      ));
    }
    case 'venue': {
      const t = tokens(item.name);
      const date = ymd(item.date);
      return index.find(e => e.kind === 'venue' && sameName(t, e.tokens) && sameDay(date, e.date));
    }
    case 'stop': {
      const t    = tokens(item.name);
      const date = ymd(item.date) ?? ymd(item.scheduledStart);
      const time = hm(item.scheduledStart);
      return index.find(e => e.kind === 'stop' && e.date === date && (
        time && e.time
          ? Math.abs(minutes(time)! - minutes(e.time)!) <= 30 && sameName(t, e.tokens)
          : sameName(t, e.tokens, true)
      ));
    }
  }
}

/**
 * Sets `duplicateOf` on every extracted item that's already in the trip and
 * strips the AI's `existingId`. Returns how many were flagged.
 */
export function flagDuplicates(
  extracted: { accommodation: any[]; venues: any[]; itineraryStops: any[]; transport: any[] },
  index: ExistingIndex,
): number {
  const byId = new Map(index.map(e => [e.id, e]));
  let count = 0;

  const run = (kind: Kind, items: any[]) => {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const ai = typeof item.existingId === 'string' ? byId.get(item.existingId.trim()) : undefined;
      delete item.existingId;
      const hit = (ai && confirmsAi(kind, item, ai) ? ai : undefined) ?? ruleMatch(kind, item, index);
      if (!hit) continue;
      item.duplicateOf = { label: hit.label, date: hit.date, time: hit.time } satisfies DuplicateOf;
      count++;
    }
  };

  run('accommodation', extracted.accommodation);
  run('venue',         extracted.venues);
  run('stop',          extracted.itineraryStops);
  run('transport',     extracted.transport);
  return count;
}
