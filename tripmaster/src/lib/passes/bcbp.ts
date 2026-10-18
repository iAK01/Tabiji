// The text inside a boarding pass barcode — IATA's Bar Coded Boarding Pass
// (Resolution 792), fixed-width whatever the airline or symbology. Only the
// mandatory fields are read: enough to name the pass, show seat and boarding
// sequence, and tell which flight it's for. Shared by the server (scanning
// uploads) and the app (showing passes, matching them to flights).

export interface BcbpLeg {
  pnr:          string;
  from:         string;   // IATA airport codes
  to:           string;
  carrier:      string;   // "FR"
  flightNumber: string;   // "94" — leading zeros dropped, any suffix letter kept
  julianDate:   number;   // day of the year the flight leaves, 1–366
  compartment:  string;
  seat:         string;   // "4D"
  sequence:     string;   // check-in / boarding sequence, "129"
}

export interface Bcbp {
  passenger: string;      // "Kenneth Killeen"
  legs:      BcbpLeg[];
}

// Per leg: PNR 7, from 3, to 3, carrier 3, flight 5, date 3, compartment 1,
// seat 4, sequence 5, passenger status 1, then the size (2 hex digits) of the
// conditional block that follows before the next leg.
const LEG_LEN = 37;

export function parseBcbp(text: string | null | undefined): Bcbp | null {
  if (!text || !/^M[1-4]/.test(text) || text.length < 23 + LEG_LEN) return null;
  const count = Number(text[1]);
  const legs: BcbpLeg[] = [];
  let at = 23;
  for (let n = 0; n < count && text.length >= at + LEG_LEN; n++) {
    const f    = (from: number, len: number) => text.slice(at + from, at + from + len);
    const from = f(7, 3);
    const to   = f(10, 3);
    const day  = Number(f(21, 3));
    const size = parseInt(f(35, 2), 16);
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !(day >= 1 && day <= 366)) break;
    legs.push({
      pnr:          f(0, 7).trim(),
      from, to,
      carrier:      f(13, 3).trim(),
      flightNumber: stripZeros(f(16, 5)),
      julianDate:   day,
      compartment:  f(24, 1).trim(),
      seat:         stripZeros(f(25, 4)),
      sequence:     stripZeros(f(29, 5)),
    });
    if (!Number.isFinite(size)) break;
    at += LEG_LEN + size;
  }
  return legs.length ? { passenger: passengerName(text.slice(2, 22)), legs } : null;
}

// "0094 " → "94", "004D" → "4D", "0129 " → "129"; free text ("INF ", "GATE") as written.
function stripZeros(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^0*(\d+[A-Z]?)$/);
  return m ? m[1] : s;
}

// "KILLEEN/KENNETH MR" → "Kenneth Killeen"
function passengerName(raw: string): string {
  const [surname = '', given = ''] = raw.trim().split('/');
  const first = given.replace(/\s+(MR|MRS|MS|MISS|MSTR|DR)$/, '');
  return [first, surname].filter(Boolean).map(titleCase).join(' ');
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

/** "FR 94", "FR94", "FR0094", "EI 123A" → { carrier, number } with zeros dropped. */
export function splitFlightNumber(raw: string | null | undefined): { carrier: string; number: string } | null {
  const m = (raw ?? '').toUpperCase().replace(/\s+/g, '').match(/^([A-Z0-9]{2}[A-Z]?)0*(\d{1,4}[A-Z]?)$/);
  return m ? { carrier: m[1], number: m[2] } : null;
}

// Day of the year for a stored wall-clock date ("2026-10-19…").
function dayOfYear(value: string | Date): number | null {
  const s = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

/** Whether a pass leg is for this transport entry: same flight, and the same day when both say. */
export function legMatches(leg: BcbpLeg, t: any): boolean {
  if ((t?.type || 'flight') !== 'flight') return false;
  const own = splitFlightNumber(t.details?.flightNumber ?? t.flightNumber);
  if (!own || own.carrier !== leg.carrier || own.number !== leg.flightNumber) return false;
  const day = t.departureTime ? dayOfYear(t.departureTime) : null;
  return day === null || day === leg.julianDate;
}

/** The transport entry a pass is for — the first leg that matches one. */
export function transportForPass(bcbp: Bcbp, transportation: any[]): number | null {
  for (const leg of bcbp.legs) {
    const i = transportation.findIndex(t => legMatches(leg, t));
    if (i >= 0) return i;
  }
  return null;
}
