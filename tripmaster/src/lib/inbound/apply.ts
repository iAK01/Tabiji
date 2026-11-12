import mongoose from 'mongoose';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripFile from '@/lib/mongodb/models/TripFile';
import { buildExistingIndex, matchExisting, resolveExisting, type ExistingIndex, type Kind } from '@/lib/extract/existingMatch';
import { locateExtracted } from '@/lib/extract/locate';
import { haversineKm } from '@/lib/geo/geocode';
import { syncLogisticsToItinerary } from '@/lib/itinerary/syncLogistics';
import { ensureItinerary, addStop, findStop, removeStop } from '@/lib/itinerary/stops';
import { addBooking, bookingIndex, removeBooking } from '@/lib/logistics/bookings';
import { LOGISTICS_ARRAYS } from '@/lib/logistics/itemId';
import type { Details, EntryKind, FieldChange, InboundItem, StoredFile, Target } from './types';

// Filing one part of a forwarded email into a trip, and taking it back out.
//
// What's safe happens straight away: an empty field filled, the ticket and links
// attached, a confirmed booking added. What would overwrite or remove something
// (a new time, a cancellation) waits for the traveller. Every write is recorded
// on the item so Undo reverses exactly that and nothing else.

export interface TripBundle {
  trip:      any;
  logistics: any;
  itinerary: any;
  index:     ExistingIndex;
}

export async function loadBundle(trip: any): Promise<TripBundle> {
  const [logistics, itinerary] = await Promise.all([
    TripLogistics.findOne({ tripId: trip._id }).lean(),
    TripItinerary.findOne({ tripId: trip._id }).lean(),
  ]);
  return { trip, logistics, itinerary, index: buildExistingIndex(logistics, itinerary) };
}

// ─── Values ───────────────────────────────────────────────────────────────────

const ymd = (v: unknown): string => {
  if (typeof v === 'string') return v.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return '';
};
const hm = (v: unknown): string => {
  const m = typeof v === 'string' ? v.match(/(?:^|T)(\d{1,2}):(\d{2})/) : null;
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};
const ymdhm = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 16) : '');
const refOf = (v: unknown): string => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const words = (v: unknown): string => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const empty = (v: unknown): boolean => v == null || (typeof v === 'string' && !v.trim()) || (typeof v === 'number' && !v);
const pinned = (c: any): boolean => Number.isFinite(c?.lat) && Number.isFinite(c?.lng);

function startOf(d: Details): string {
  if (d.scheduledStart) return d.scheduledStart;
  return d.date && d.time ? `${d.date}T${d.time}:00` : '';
}

/** The day an item happens on, for checking it fits the trip. */
export function itemDate(item: InboundItem): string {
  const d = item.details;
  if (!d) return '';
  switch (item.kind) {
    case 'accommodation': return ymd(d.checkIn) || ymd(d.date);
    case 'transport':     return ymd(d.departureTime) || ymd(d.date);
    default:              return ymd(d.date) || ymd(d.scheduledStart);
  }
}

/** Within the trip's dates, a day either side (an early arrival, a late flight home). */
export function fitsTrip(date: string, trip: any): boolean {
  if (!date || !trip?.startDate || !trip?.endDate) return true;
  const day = 24 * 60 * 60 * 1000;
  const t   = Date.parse(date);
  return t >= new Date(trip.startDate).getTime() - day && t <= new Date(trip.endDate).getTime() + day;
}

function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    o[k] = o[k] && typeof o[k] === 'object' ? { ...o[k] } : {};
    o = o[k];
  }
  const last = keys[keys.length - 1];
  if (value === undefined) delete o[last];
  else o[last] = value;
}

const same = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ─── What the email would set ─────────────────────────────────────────────────

type Compare = 'text' | 'date' | 'time' | 'datetime' | 'ref' | 'notes' | 'fill';

interface FieldSpec { field: string; label: string; value: (d: Details) => any; compare: Compare }

const FIELDS: Record<EntryKind, FieldSpec[]> = {
  accommodation: [
    { field: 'checkIn',            label: 'Check-in date',     value: d => ymd(d.checkIn),  compare: 'date' },
    { field: 'checkOut',           label: 'Check-out date',    value: d => ymd(d.checkOut), compare: 'date' },
    { field: 'checkInTime',        label: 'Check-in time',     value: d => d.checkInTime,   compare: 'time' },
    { field: 'checkOutTime',       label: 'Check-out time',    value: d => d.checkOutTime,  compare: 'time' },
    { field: 'confirmationNumber', label: 'Booking reference', value: d => d.confirmationNumber, compare: 'ref' },
    { field: 'notes',              label: 'Notes',             value: d => d.notes,         compare: 'notes' },
  ],
  venue: [
    { field: 'date',  label: 'Date',  value: d => ymd(d.date) || ymd(d.scheduledStart), compare: 'date' },
    { field: 'time',  label: 'Time',  value: d => d.time || hm(d.scheduledStart),       compare: 'time' },
    { field: 'notes', label: 'Notes', value: d => d.notes,                              compare: 'notes' },
  ],
  transport: [
    { field: 'departureTime',        label: 'Departure',         value: d => d.departureTime,      compare: 'datetime' },
    { field: 'arrivalTime',          label: 'Arrival',           value: d => d.arrivalTime,        compare: 'datetime' },
    { field: 'confirmationNumber',   label: 'Booking reference', value: d => d.confirmationNumber, compare: 'ref' },
    { field: 'details.flightNumber', label: 'Flight number',     value: d => d.flightNumber,       compare: 'ref' },
    { field: 'details.operator',     label: 'Operator',          value: d => d.operator,           compare: 'fill' },
    { field: 'departureLocation',    label: 'Departure point',   value: d => d.departureLocation,  compare: 'fill' },
    { field: 'arrivalLocation',      label: 'Arrival point',     value: d => d.arrivalLocation,    compare: 'fill' },
    { field: 'notes',                label: 'Notes',             value: d => d.notes,              compare: 'notes' },
  ],
  stop: [
    { field: 'scheduledStart', label: 'Time',      value: startOf,                       compare: 'datetime' },
    { field: 'duration',       label: 'Length',    value: d => d.duration || undefined,  compare: 'fill' },
    { field: 'reference',      label: 'Booking reference', value: d => d.confirmationNumber, compare: 'ref' },
    { field: 'notes',          label: 'Notes',     value: d => d.notes,                  compare: 'notes' },
  ],
};

const HAS_PLACE: Record<EntryKind, boolean> = { accommodation: true, venue: true, stop: true, transport: false };

function differs(compare: Compare, cur: any, next: any): boolean {
  switch (compare) {
    case 'date':     return ymd(cur) !== ymd(next);
    case 'time':     return hm(String(cur)) !== hm(String(next));
    case 'datetime': return ymdhm(cur) !== ymdhm(next);
    case 'ref':      return refOf(cur) !== refOf(next);
    default:         return words(cur) !== words(next);
  }
}

/** Blanks the email fills, and values it disagrees with (offered, never written unasked). */
export function compareEntry(kind: EntryKind, entry: any, d: Details): { filled: FieldChange[]; changes: FieldChange[] } {
  const filled: FieldChange[] = [];
  const changes: FieldChange[] = [];

  for (const f of FIELDS[kind]) {
    const next = f.value(d);
    if (empty(next)) continue;
    const cur = getPath(entry, f.field);
    if (empty(cur)) { filled.push({ field: f.field, label: f.label, from: undefined, to: next }); continue; }
    if (f.compare === 'fill') continue;
    if (f.compare === 'notes') {
      // Notes only grow — what's new goes under what's there, nothing to approve.
      if (!words(cur).includes(words(next))) filled.push({ field: f.field, label: f.label, from: cur, to: `${cur}\n${next}` });
      continue;
    }
    if (differs(f.compare, cur, next)) changes.push({ field: f.field, label: f.label, from: cur, to: next });
  }

  if (HAS_PLACE[kind] && d.address) {
    const curAddr = entry.address;
    const next    = pinned(d.coordinates) ? d.coordinates : undefined;
    if (empty(curAddr)) {
      filled.push({ field: 'address', label: 'Address', from: undefined, to: d.address });
      if (next && !pinned(entry.coordinates)) filled.push({ field: 'coordinates', label: 'Map pin', from: entry.coordinates, to: next });
    } else if (words(curAddr) !== words(d.address)) {
      // Two spellings of the same place aren't a change.
      const samePlace = next && pinned(entry.coordinates) && haversineKm(entry.coordinates.lat, entry.coordinates.lng, next.lat, next.lng) <= 0.3;
      if (!samePlace) {
        changes.push({ field: 'address', label: 'Address', from: curAddr, to: d.address });
        if (next) changes.push({ field: 'coordinates', label: 'Map pin', from: entry.coordinates, to: next });
      } else if (!pinned(entry.coordinates)) {
        filled.push({ field: 'coordinates', label: 'Map pin', from: entry.coordinates, to: next });
      }
    } else if (next && !pinned(entry.coordinates)) {
      filled.push({ field: 'coordinates', label: 'Map pin', from: entry.coordinates, to: next });
    }
  }

  return { filled, changes };
}

// ─── Saved entries ────────────────────────────────────────────────────────────

/** Points an item at a saved entry, giving an older booking its own id if it has none yet. */
export async function targetFor(id: string, bundle: TripBundle): Promise<{ target: Target; entry: any } | null> {
  const hit = resolveExisting(id, bundle.logistics, bundle.itinerary);
  if (!hit) return null;
  if (hit.kind === 'stop') {
    if (!hit.entry?._id) return null;
    return { target: { kind: 'stop', stopId: String(hit.entry._id), label: hit.entry.name }, entry: hit.entry };
  }
  let itemId = hit.entry?.id as string | undefined;
  if (!itemId) {
    itemId = new mongoose.Types.ObjectId().toString();
    const key = LOGISTICS_ARRAYS[hit.kind];
    await TripLogistics.updateOne({ tripId: bundle.trip._id }, { $set: { [`${key}.${hit.index}.id`]: itemId } });
  }
  const label = hit.entry?.name
    || [hit.entry?.details?.flightNumber, [hit.entry?.departureLocation, hit.entry?.arrivalLocation].filter(Boolean).join(' → ')].filter(Boolean).join(' · ')
    || 'Booking';
  return { target: { kind: hit.kind, itemId, label }, entry: hit.entry };
}

async function currentEntry(tripId: string, target: Target): Promise<any | null> {
  if (target.kind === 'stop') {
    const itinerary = await TripItinerary.findOne({ tripId }).lean();
    return findStop(itinerary, target.stopId!)?.stop ?? null;
  }
  const logistics = await TripLogistics.findOne({ tripId }).lean() as any;
  const i = bookingIndex(logistics, target.kind, target.itemId!);
  return i >= 0 ? logistics[LOGISTICS_ARRAYS[target.kind]][i] : null;
}

/**
 * Writes field changes onto a saved entry: `to` values, or with `revert` their
 * `from` values — but only where the field still holds what this email put
 * there, so nothing the traveller changed since is touched. Returns the labels
 * of fields left alone.
 */
export async function writeFields(tripId: string, target: Target, list: FieldChange[], revert = false): Promise<{ ok: boolean; skipped: string[] }> {
  const skipped: string[] = [];
  if (!list.length) return { ok: true, skipped };

  const apply = (entry: any) => {
    for (const c of list) {
      if (revert && !same(getPath(entry, c.field), c.to)) { skipped.push(c.label); continue; }
      setPath(entry, c.field, revert ? c.from : c.to);
    }
  };

  if (target.kind === 'stop') {
    const itinerary = await TripItinerary.findOne({ tripId });
    const found = findStop(itinerary, target.stopId!);
    if (!itinerary || !found) return { ok: false, skipped };
    const stop = { ...found.stop };
    apply(stop);
    // A new time on another day moves the stop to that day.
    const day = ymd(stop.scheduledStart);
    if (day && day !== ymd(found.day.date)) {
      const dest = itinerary.days.find((d: any) => ymd(d.date) === day || new Date(d.date).toDateString() === new Date(day).toDateString());
      if (!dest) return { ok: false, skipped };
      found.day.stops.splice(found.index, 1);
      dest.stops.push(stop);
      dest.stops.sort((a: any, b: any) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    } else {
      found.day.stops[found.index] = stop;
      found.day.stops.sort((a: any, b: any) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    }
    itinerary.markModified('days');
    await itinerary.save();
    return { ok: true, skipped };
  }

  const logistics = await TripLogistics.findOne({ tripId });
  const i = bookingIndex(logistics, target.kind, target.itemId!);
  if (!logistics || i < 0) return { ok: false, skipped };
  const key = LOGISTICS_ARRAYS[target.kind];
  const cur = logistics[key][i];
  const entry = { ...cur, details: cur.details ? { ...cur.details } : cur.details };
  if (entry.details === undefined) delete entry.details;
  apply(entry);
  logistics[key][i] = entry;
  logistics.markModified(key);
  await logistics.save();
  await syncLogisticsToItinerary(tripId, logistics);
  return { ok: true, skipped };
}

// ─── Creating ─────────────────────────────────────────────────────────────────

const STOP_TYPES      = ['flight', 'meeting', 'meal', 'breakfast', 'activity', 'sightseeing', 'transport', 'transfer', 'work', 'gig', 'other'];
const VENUE_TYPES     = ['concert', 'conference', 'restaurant', 'sports', 'attraction', 'business', 'other'];
const TRANSPORT_TYPES = ['flight', 'train', 'bus', 'ferry', 'car', 'car_hire', 'taxi', 'private_transfer', 'parking'];
const oneOf = (v: string, list: string[], fallback: string) => (list.includes(v) ? v : fallback);

/** Adds the booking or stop an item describes. Returns why not, when it can't. */
export async function createEntry(item: InboundItem, bundle: TripBundle): Promise<{ target: Target } | { reason: string }> {
  const d = item.details;
  if (!d || item.kind === 'document') return { reason: 'Nothing to add' };
  const tripId = String(bundle.trip._id);
  const name   = d.name || item.title;

  if (item.kind === 'stop') {
    const start = startOf(d);
    if (!start) return { reason: 'The email gives no time for it' };
    await ensureItinerary(bundle.trip);
    const res = await addStop(bundle.trip, ymd(start), {
      name,
      type:           oneOf(d.type, STOP_TYPES, 'other'),
      scheduledStart: start,
      duration:       d.duration || 60,
      address:        d.address ?? '',
      coordinates:    pinned(d.coordinates) ? d.coordinates : null,
      notes:          d.notes ?? '',
      ...(d.confirmationNumber ? { reference: d.confirmationNumber } : {}),
      source:         'imported',
    });
    if (res.error) return { reason: res.error === 'Day not found' ? `${ymd(start)} isn't one of the trip's days` : 'The trip has no itinerary yet' };
    return { target: { kind: 'stop', stopId: String(res.stop._id), label: name } };
  }

  const body =
    item.kind === 'accommodation' ? {
      type: d.type || 'hotel', name,
      address: d.address ?? '', coordinates: pinned(d.coordinates) ? d.coordinates : null,
      checkIn: ymd(d.checkIn), checkOut: ymd(d.checkOut),
      checkInTime: d.checkInTime, checkOutTime: d.checkOutTime,
      confirmationNumber: d.confirmationNumber, notes: d.notes, status: 'confirmed',
    } : item.kind === 'venue' ? {
      type: oneOf(d.type, VENUE_TYPES, 'other'), name,
      address: d.address ?? '', coordinates: pinned(d.coordinates) ? d.coordinates : null,
      date: ymd(d.date) || ymd(d.scheduledStart), time: d.time || hm(d.scheduledStart),
      notes: d.notes, status: 'confirmed',
    } : {
      type: oneOf(d.type, TRANSPORT_TYPES, 'flight'), status: 'confirmed',
      departureLocation: d.departureLocation, arrivalLocation: d.arrivalLocation,
      departureTime: d.departureTime, arrivalTime: d.arrivalTime,
      confirmationNumber: d.confirmationNumber, notes: d.notes,
      details: { flightNumber: d.flightNumber, operator: d.operator },
    };

  if (item.kind === 'transport' && !d.departureTime && !d.date) return { reason: 'The email gives no date for it' };
  const { item: saved } = await addBooking(tripId, item.kind, body);
  return { target: { kind: item.kind, itemId: saved.id, label: item.kind === 'transport' ? item.title : name } };
}

// ─── Files and links ──────────────────────────────────────────────────────────

async function linkFor(tripId: string, target: Target | null) {
  if (!target) return undefined;
  if (target.kind === 'stop') return { collection: 'itinerary_stop', entryId: target.stopId, label: target.label };
  const logistics = await TripLogistics.findOne({ tripId }, LOGISTICS_ARRAYS[target.kind]).lean();
  const i = bookingIndex(logistics, target.kind, target.itemId!);
  return i >= 0 ? { collection: target.kind, entryId: String(i), label: target.label } : undefined;
}

/** Puts the item's attachments and links into the trip's resources, on the entry they're for. */
export async function attachFiles(
  item: InboundItem, emailId: string, files: StoredFile[], tripId: string, userId: string,
): Promise<{ files: StoredFile[]; links: number }> {
  const linkedTo = await linkFor(tripId, item.target);
  const fileIds: string[] = [];
  const added: StoredFile[] = [];
  let links = 0;

  for (const n of item.attachments) {
    const f = files.find(x => x.index === n);
    if (!f) continue;
    const dupe = await TripFile.findOne({
      tripId, resourceType: 'file', name: f.name, size: f.size,
      ...(linkedTo ? { 'linkedTo.collection': linkedTo.collection, 'linkedTo.entryId': linkedTo.entryId } : {}),
    }, '_id').lean();
    if (dupe) continue;
    const isBoarding = !!f.barcode?.bcbp;
    const doc = await TripFile.create({
      tripId, userId,
      resourceType: 'file',
      name:     f.name,
      type:     isBoarding ? 'boarding_pass' : (f.barcode && item.documentType === 'other' ? 'ticket' : item.documentType),
      gcsPath:  f.gcsPath,
      gcsUrl:   f.gcsUrl,
      mimeType: f.mimeType,
      size:     f.size,
      linkedTo,
      fromEmail: emailId,
      ...(f.barcode ? { barcode: f.barcode, barcodeScannedAt: new Date() } : {}),
    });
    fileIds.push(String(doc._id));
    added.push(f);
  }

  for (const l of item.links) {
    const dupe = await TripFile.findOne({ tripId, resourceType: 'link', linkUrl: l.url }, '_id').lean();
    if (dupe) continue;
    const doc = await TripFile.create({
      tripId, userId,
      resourceType: 'link',
      name:     l.label,
      type:     linkedTo ? 'booking_reference' : 'useful_info',
      linkUrl:  l.url,
      linkedTo,
      fromEmail: emailId,
    });
    fileIds.push(String(doc._id));
    links++;
  }

  item.fileIds = [...item.fileIds, ...fileIds];
  return { files: added, links };
}

// ─── What happened, in a line ────────────────────────────────────────────────

function fileWord(f: StoredFile): string {
  if (f.mimeType === 'application/vnd.apple.pkpass') return 'Wallet pass';
  if (f.mimeType === 'text/calendar') return 'calendar invite';
  if (f.barcode) return 'ticket';
  if (f.mimeType === 'application/pdf') return 'PDF';
  if (f.mimeType.startsWith('image/')) return 'image';
  return 'file';
}

function attachedWords(att: { files: StoredFile[]; links: number }): string[] {
  const words = att.files.map(fileWord);
  if (att.links) words.push(att.links === 1 ? '1 link' : `${att.links} links`);
  return words;
}

/** "Added: booking reference, notes, Wallet pass, 3 links." — from the writes, so it's never more than what changed. */
function outcome(item: InboundItem, att: { files: StoredFile[]; links: number }, tripName: string): string {
  const attached = attachedWords(att);
  if (item.created) {
    return `Added to ${tripName}.${attached.length ? ` Attached: ${attached.join(', ')}.` : ''}`;
  }
  if (!item.target) {
    return attached.length ? `Saved to Resources: ${attached.join(', ')}.` : 'Already in Resources — nothing new.';
  }
  const labels = [...new Set(item.filled.map(c => c.label))];
  const fields = labels.filter(l => !(l === 'Map pin' && labels.includes('Address'))).map(l => l.toLowerCase());
  const all = [...fields, ...attached];
  return all.length ? `Added: ${all.join(', ')}.` : 'Already up to date — nothing new in this email.';
}

// ─── Placing an item in a trip ────────────────────────────────────────────────

/** Address lookup for the item's place, once, against the trip's area. */
export async function locateItem(item: InboundItem, bundle: TripBundle) {
  const d = item.details;
  if (!d || d.located || item.kind === 'transport' || item.kind === 'document') return;
  const place: any = { name: d.name || item.title, address: d.address, building: d.building, searchQuery: d.searchQuery };
  await locateExtracted([place], bundle.trip, bundle.logistics);
  d.address  = place.address ?? d.address;
  if (pinned(place.coordinates)) d.coordinates = place.coordinates;
  d.located  = true;
}

const MATCH_KIND: Record<EntryKind, Kind> = { stop: 'stop', venue: 'venue', accommodation: 'accommodation', transport: 'transport' };

/**
 * Files an item into its trip: finds what it's about, fills blanks, attaches
 * its files, adds it when it's new and confirmed. `aiExistingId` is what the
 * reading said it matched. Leaves it pending, with a note, when it needs you.
 */
export async function placeItem(
  item: InboundItem, bundle: TripBundle, aiExistingId: string | null,
  ctx: { emailId: string; files: StoredFile[]; userId: string; addNew: boolean },
): Promise<void> {
  const tripId = String(bundle.trip._id);
  item.tripId  = tripId;
  // Placed afresh — after an Undo, what it was attached to before no longer counts.
  item.target  = null;
  item.created = false;
  item.filled  = [];
  item.changes = [];

  if (item.kind === 'document' || item.action === 'reference') {
    const att = await attachFiles(item, ctx.emailId, ctx.files, tripId, ctx.userId);
    item.why   = outcome(item, att, bundle.trip.name);
    item.state = 'applied';
    return;
  }

  const kind = item.kind as EntryKind;
  await locateItem(item, bundle);

  const trustAi = item.action === 'change' || item.action === 'cancel';
  const hit = matchExisting(MATCH_KIND[kind], item.details ?? {}, bundle.index, aiExistingId, trustAi);
  const found = hit ? await targetFor(hit.id, bundle) : null;

  if (found) {
    item.target = found.target;
    if (item.action === 'cancel') {
      item.state = 'pending';
      item.note  = 'The email says this is cancelled';
      return;
    }
    if (item.action === 'create' || item.action === 'optional') item.action = 'enrich';
    // Compared against the kind actually saved — a session can match its venue.
    const { filled, changes } = item.details ? compareEntry(found.target.kind, found.entry, item.details) : { filled: [], changes: [] };
    if (filled.length) {
      const res = await writeFields(tripId, found.target, filled);
      if (res.ok) item.filled = filled;
    }
    item.changes = changes;
    const att = await attachFiles(item, ctx.emailId, ctx.files, tripId, ctx.userId);
    item.why   = outcome(item, att, bundle.trip.name);
    item.state = 'applied';
    return;
  }

  if (item.action === 'cancel' || item.action === 'change' || item.action === 'enrich') {
    item.state = 'pending';
    item.note  = 'Couldn’t find this in the trip';
    return;
  }
  if (item.action === 'optional' && !ctx.addNew) {
    item.state = 'pending';
    item.note  = 'Optional — add it if you’re going';
    return;
  }

  const made = await createEntry(item, bundle);
  if ('reason' in made) {
    item.state = 'pending';
    item.note  = made.reason;
    return;
  }
  item.target  = made.target;
  item.created = true;
  if (item.action === 'optional') item.action = 'create';
  const att = await attachFiles(item, ctx.emailId, ctx.files, tripId, ctx.userId);
  item.why   = outcome(item, att, bundle.trip.name);
  item.state = 'applied';
}

// ─── Cancelling, undoing ──────────────────────────────────────────────────────

/** Marks the saved entry cancelled without deleting it: a booking's status, a stop's "Not going". */
export async function markCancelled(item: InboundItem): Promise<boolean> {
  if (!item.tripId || !item.target) return false;
  const entry = await currentEntry(item.tripId, item.target);
  if (!entry) return false;
  const list: FieldChange[] = item.target.kind === 'stop'
    ? [{ field: 'skipped', label: 'Not going', from: entry.skipped, to: true }]
    : [{ field: 'status', label: 'Status', from: entry.status, to: 'cancelled' }];
  const res = await writeFields(item.tripId, item.target, list);
  if (res.ok) item.cancelled = list;
  return res.ok;
}

/** Reverses what this item did. Returns what couldn't be put back, for the message. */
export async function undoItem(item: InboundItem): Promise<string[]> {
  const left: string[] = [];
  if (item.tripId && item.target) {
    if (item.created) {
      const gone = item.target.kind === 'stop'
        ? await removeStop(item.tripId, item.target.stopId!)
        : await removeBooking(item.tripId, item.target.kind, item.target.itemId!);
      if (!gone) left.push(`${item.target.label} was already removed`);
    } else {
      const res = await writeFields(item.tripId, item.target, [...item.cancelled, ...item.accepted, ...item.filled], true);
      left.push(...res.skipped.map(l => `${l} (changed since)`));
    }
  }
  if (item.fileIds.length) await TripFile.deleteMany({ _id: { $in: item.fileIds }, fromEmail: { $exists: true } });
  item.fileIds   = [];
  item.filled    = [];
  item.accepted  = [];
  item.cancelled = [];
  item.state     = 'undone';
  return left;
}
