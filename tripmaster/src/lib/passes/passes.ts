// Which scanned passes belong to a booking, and what to show for each. Pure —
// shared by the flight card, the pass view, the airport moment and the
// notification planner.

import { legMatches, type Bcbp, type BcbpLeg } from './bcbp';

export interface Barcode {
  format: string;
  text:   string;
  svg:    string;
  bcbp?:  Bcbp | null;
}

export interface Pass {
  file:     any;              // the TripFile it was read from
  barcode:  Barcode;
  leg:      BcbpLeg | null;   // the boarding-pass leg for this booking (or its first)
  mismatch: boolean;          // a boarding pass, but for a different flight or day
}

/** Passes linked to transport `index`, newest kept when one was re-uploaded (seat change, re-check-in). */
export function passesFor(files: any[], index: number, t: any): Pass[] {
  const seen  = new Set<string>();
  const out: Pass[] = [];
  const newest = [...files].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  for (const file of newest) {
    const barcode: Barcode | undefined = file?.barcode;
    if (!barcode?.svg || file.linkedTo?.collection !== 'transport' || file.linkedTo?.entryId !== String(index)) continue;
    const legs  = barcode.bcbp?.legs ?? [];
    const own   = legs.find(l => legMatches(l, t)) ?? null;
    const leg   = own ?? legs[0] ?? null;
    const key   = leg ? `${barcode.bcbp?.passenger}|${leg.carrier}${leg.flightNumber}|${leg.julianDate}` : barcode.text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ file, barcode, leg, mismatch: legs.length > 0 && !own });
  }
  return out.sort((a, b) => (a.barcode.bcbp?.passenger ?? '').localeCompare(b.barcode.bcbp?.passenger ?? ''));
}

/** The ones that are really for this booking — a pass for another flight is only ever shown with a warning. */
export function passesForSure(files: any[], index: number, t: any): Pass[] {
  return passesFor(files, index, t).filter(p => !p.mismatch);
}

// ── Adding one ────────────────────────────────────────────────────────────────

/** Bookings that come with a scannable pass or ticket. */
export const TICKETED = new Set(['flight', 'train', 'bus', 'ferry']);

const TICKET_DOC: Record<string, string> = {
  flight: 'boarding_pass', train: 'train_ticket', bus: 'bus_ticket', ferry: 'ferry_ticket',
};

/** The Resources document type for this booking's pass. */
export function ticketDocType(t: any): string {
  return TICKET_DOC[t?.type || 'flight'] ?? 'other';
}

/** Whether to offer adding a pass: a booked journey that hasn't left yet. */
export function wantsPass(t: any): boolean {
  if (!TICKETED.has(t?.type || 'flight')) return false;
  if (['not_booked', 'pending', 'cancelled'].includes(t?.status)) return false;
  if (!t?.departureTime) return true;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return String(t.departureTime).slice(0, 10) >= yesterday;
}

/** "Add boarding pass" / "Add ticket" */
export function addPassLabel(t: any): string {
  return (t?.type || 'flight') === 'flight' ? 'Add boarding pass' : 'Add ticket';
}

/** How a pass's file is named in Resources: "FR 94 boarding pass". */
export function passFileName(t: any): string {
  const what = (t?.type || 'flight') === 'flight' ? 'boarding pass' : 'ticket';
  const who  = t?.details?.flightNumber || t?.details?.operator;
  return who ? `${who} ${what}` : what[0].toUpperCase() + what.slice(1);
}

/** Same wording as the Resources "Link to" picker. */
export function ticketLinkLabel(t: any): string {
  const route = [t?.departureLocation, t?.arrivalLocation].filter(Boolean).join(' to ');
  return (t?.type || 'flight') === 'flight'
    ? [t?.details?.airline, t?.details?.flightNumber, route].filter(Boolean).join(' - ')
    : [t?.details?.operator, route].filter(Boolean).join(' - ');
}

export function passLabel(p: Pass): string {
  return p.barcode.bcbp ? 'Boarding pass' : 'Ticket';
}

/** "Seat 4D · Seq 129" — the check-in sequence number, as airlines print it. */
export function passSummary(p: Pass): string {
  if (!p.leg) return '';
  return [p.leg.seat && `Seat ${p.leg.seat}`, p.leg.sequence && `Seq ${p.leg.sequence}`].filter(Boolean).join(' · ');
}

/** "FR 95 on 25 Oct" — what a pass that doesn't match its booking is actually for. The barcode has no year. */
export function legFlight(leg: BcbpLeg, near?: string | Date | null): string {
  const year = near ? new Date(near).getUTCFullYear() : new Date().getUTCFullYear();
  const day  = new Date(Date.UTC(year, 0, leg.julianDate))
    .toLocaleDateString('en-IE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${leg.carrier} ${leg.flightNumber} on ${day}`;
}

/** SVG markup → an <img> source. Shown as an image, so nothing in it can run. */
export function barcodeSrc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
