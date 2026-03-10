// logistics.helpers.tsx
// Suggested location: src/components/logistics/logistics.helpers.tsx
//
// Shared constants, types, blank states, label helpers, date utilities, and gap detection.
// No React state, no effects — safe to import from any sub-component.

import FlightIcon          from '@mui/icons-material/Flight';
import TrainIcon           from '@mui/icons-material/Train';
import DirectionsBusIcon   from '@mui/icons-material/DirectionsBus';
import DirectionsCarIcon   from '@mui/icons-material/DirectionsCar';
import DirectionsBoatIcon  from '@mui/icons-material/DirectionsBoat';
import LocalTaxiIcon       from '@mui/icons-material/LocalTaxi';
import PedalBikeIcon       from '@mui/icons-material/PedalBike';
import AirportShuttleIcon  from '@mui/icons-material/AirportShuttle';
import PlaceIcon           from '@mui/icons-material/Place';
import MusicNoteIcon       from '@mui/icons-material/MusicNote';
import BusinessIcon        from '@mui/icons-material/Business';
import RestaurantIcon      from '@mui/icons-material/Restaurant';
import SportsSoccerIcon    from '@mui/icons-material/SportsSoccer';
import AttractionIcon      from '@mui/icons-material/AccountBalance';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Single source of truth — import into any sub-component that needs them.
export const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

// ─── Status dot colours ───────────────────────────────────────────────────────
export const DOT_COLOUR: Record<string, string> = {
  not_booked: '#9e9e9e',
  pending:    '#ed6c02',
  booked:     '#2C3E50',
  confirmed:  '#2e7d32',
  cancelled:  '#d32f2f',
};

// ─── Transport types ──────────────────────────────────────────────────────────
export const TRANSPORT_TYPES = [
  { value: 'flight',           label: 'Flight',   Icon: FlightIcon },
  { value: 'train',            label: 'Train',    Icon: TrainIcon },
  { value: 'bus',              label: 'Bus',      Icon: DirectionsBusIcon },
  { value: 'ferry',            label: 'Ferry',    Icon: DirectionsBoatIcon },
  { value: 'car',              label: 'Car',      Icon: DirectionsCarIcon },
  { value: 'car_hire',         label: 'Car hire', Icon: DirectionsCarIcon },
  { value: 'taxi',             label: 'Taxi',     Icon: LocalTaxiIcon },
  { value: 'private_transfer', label: 'Transfer', Icon: AirportShuttleIcon },
  { value: 'bicycle',          label: 'Bicycle',  Icon: PedalBikeIcon },
] as const;

export type TransportType = typeof TRANSPORT_TYPES[number]['value'];

// Transport types where departure location is a navigable real-world place
export const NAVIGABLE_TRANSPORT_TYPES = new Set([
  'train', 'bus', 'ferry', 'car', 'bicycle', 'car_hire', 'taxi', 'private_transfer',
]);

// ─── Venue types ──────────────────────────────────────────────────────────────
export const VENUE_TYPES = [
  { value: 'concert',    label: 'Concert / Gig', Icon: MusicNoteIcon },
  { value: 'conference', label: 'Conference',    Icon: BusinessIcon },
  { value: 'restaurant', label: 'Restaurant',   Icon: RestaurantIcon },
  { value: 'sports',     label: 'Sports',       Icon: SportsSoccerIcon },
  { value: 'attraction', label: 'Attraction',   Icon: AttractionIcon },
  { value: 'business',   label: 'Business',     Icon: BusinessIcon },
  { value: 'other',      label: 'Other',        Icon: PlaceIcon },
] as const;

export type VenueType = typeof VENUE_TYPES[number]['value'];

export function venueIcon(type: string, props?: object) {
  const match = VENUE_TYPES.find(v => v.value === type);
  if (!match) return <PlaceIcon {...props} />;
  const { Icon } = match;
  return <Icon {...props} />;
}

export function transportIcon(type: string, props?: object) {
  const match = TRANSPORT_TYPES.find(t => t.value === type);
  if (!match) return <FlightIcon {...props} />;
  const { Icon } = match;
  return <Icon {...props} />;
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const TRANSPORT_STATUSES = ['not_booked', 'pending', 'booked', 'confirmed', 'cancelled'];
export const ACCOM_TYPES        = ['hotel', 'airbnb', 'hostel', 'friends_family', 'camping', 'other'];
export const RAIL_SUBTYPES      = ['intercity', 'commuter', 'metro', 'tram'];

// ─── Blank states ─────────────────────────────────────────────────────────────
export const BLANK_TRANSPORT = {
  type:                 'flight' as TransportType,
  status:               'not_booked',
  departureLocation:    '',
  departureCoordinates: null as { lat: number; lng: number } | null,
  arrivalLocation:      '',
  arrivalCoordinates:   null as { lat: number; lng: number } | null,
  departureTime:        '',
  arrivalTime:          '',
  confirmationNumber:   '',
  cost:                 '',
  notes:                '',
  details: {
    airline:             '',
    airlineIata:         '',
    flightNumber:        '',
    seat:                '',
    cabin:               '',
    operator:            '',
    railSubtype:         '',
    rentalCompany:       '',
    pickupLocation:      '',
    pickupCoordinates:   null as { lat: number; lng: number } | null,
    dropoffLocation:     '',
    dropoffCoordinates:  null as { lat: number; lng: number } | null,
    vehicle:             '',
  },
};

export const BLANK_ACCOM = {
  type:               'hotel',
  status:             'not_booked',
  name:               '',
  address:            '',
  coordinates:        null as { lat: number; lng: number } | null,
  addressVerified:    false,
  checkIn:            '',
  checkOut:           '',
  confirmationNumber: '',
  cost:               '',
  notes:              '',
  includesBreakfast:  false,
  breakfastTime:      '08:00',
};

export const BLANK_VENUE = {
  type:               'concert' as VenueType,
  status:             'not_booked',
  name:               '',
  address:            '',
  coordinates:        null as { lat: number; lng: number } | null,
  date:               '',
  time:               '',
  endTime:            '',
  confirmationNumber: '',
  cost:               '',
  notes:              '',
  website:            '',
};

// ─── Label helpers ────────────────────────────────────────────────────────────
export function getTransportLabel(t: any): string {
  switch (t.type) {
    case 'flight': {
      const flight = t.details?.flightNumber ?? t.flightNumber ?? '';
      const from   = t.departureLocation ?? t.departureAirport ?? '';
      const to     = t.arrivalLocation   ?? t.arrivalAirport   ?? '';
      return [flight, from && to ? `${from} → ${to}` : (from || to)].filter(Boolean).join(' · ');
    }
    case 'train':
    case 'bus':
    case 'ferry': {
      const op    = t.details?.operator ?? '';
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return [route, op].filter(Boolean).join(' · ');
    }
    case 'car_hire': {
      const co = t.details?.rentalCompany ?? '';
      const pu = t.details?.pickupLocation ?? t.departureLocation ?? '';
      return [co, pu ? `Pickup: ${pu}` : ''].filter(Boolean).join(' · ');
    }
    case 'car':
    case 'bicycle': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `${from} → ${to}` : (from || to || t.type);
    }
    case 'taxi':
    case 'private_transfer': {
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const label = TRANSPORT_TYPES.find(x => x.value === t.type)?.label ?? 'Transfer';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return [label, route].filter(Boolean).join(': ');
    }
    default:
      return t.departureLocation ?? t.type ?? 'Transport';
  }
}

export function getTransportSubtitle(t: any): string {
  switch (t.type) {
    case 'flight':           return t.details?.airline  ?? t.airline   ?? '';
    case 'train':
    case 'bus':
    case 'ferry':            return t.details?.operator ?? '';
    case 'car_hire':         return t.details?.vehicle  ?? '';
    case 'taxi':
    case 'private_transfer': return t.details?.operator ?? '';
    default:                 return '';
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export const toISO = (d: Date) => d.toISOString().split('T')[0];

// Always strip to YYYY-MM-DD before any date arithmetic — MongoDB sends full ISO strings
export const toDateOnly = (s: string) => (s ? s.split('T')[0] : '');

export function addDays(dateStr: string, days: number): string {
  const d = new Date(toDateOnly(dateStr) + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export const MONTH_NAMES = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
];
export const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// ─── Gap detection ────────────────────────────────────────────────────────────
// Runs after saving a flight. Checks whether the user has ground transport covering
// the airport at each end. If not, surfaces a contextual prompt.

export interface GapPromptItem {
  type:  'to_airport' | 'from_airport';
  label: string;   // human-readable airport name, e.g. "DUB — Dublin"
  time:  string;   // ISO datetime — flight departure (to_airport) or arrival (from_airport)
  prefill: {
    type:               TransportType;
    departureLocation?: string;
    arrivalLocation?:   string;
    departureTime?:     string;
  };
}

// Extract the IATA code from a stored location string, e.g. "DUB — Dublin" → "DUB"
export function extractIata(location: string): string {
  return (location ?? '').split('—')[0].trim().split(' ')[0].trim().toUpperCase();
}

export function detectTransportGaps(
  savedFlight: typeof BLANK_TRANSPORT,
  allTransport: any[],
): GapPromptItem[] {
  if (savedFlight.type !== 'flight') return [];

  const gaps: GapPromptItem[] = [];
  // Only non-flight items can serve as airport ground transfers
  const transfers = allTransport.filter(t => t.type !== 'flight');

  // ── Gap: nothing getting user TO the departure airport ────────────────────
  if (savedFlight.departureLocation && savedFlight.departureTime) {
    const depIata      = extractIata(savedFlight.departureLocation);
    const flightDepMs  = new Date(savedFlight.departureTime).getTime();

    const covered = transfers.some(t => {
      const arrLoc = (t.arrivalLocation ?? t.details?.dropoffLocation ?? '').toUpperCase();
      if (!arrLoc.includes(depIata)) return false;
      const arrMs = t.arrivalTime ? new Date(t.arrivalTime).getTime() : null;
      // Must arrive at airport within 8 hours before flight
      return arrMs !== null && arrMs <= flightDepMs && (flightDepMs - arrMs) <= 8 * 3600000;
    });

    if (!covered) {
      gaps.push({
        type:  'to_airport',
        label: savedFlight.departureLocation,
        time:  savedFlight.departureTime,
        prefill: { type: 'taxi', arrivalLocation: savedFlight.departureLocation },
      });
    }
  }

  // ── Gap: nothing taking user FROM the arrival airport ─────────────────────
  if (savedFlight.arrivalLocation && savedFlight.arrivalTime) {
    const arrIata     = extractIata(savedFlight.arrivalLocation);
    const flightArrMs = new Date(savedFlight.arrivalTime).getTime();

    const covered = transfers.some(t => {
      const depLoc = (t.departureLocation ?? '').toUpperCase();
      if (!depLoc.includes(arrIata)) return false;
      const depMs = t.departureTime ? new Date(t.departureTime).getTime() : null;
      // Must depart from airport within 8 hours after landing
      return depMs !== null && depMs >= flightArrMs && (depMs - flightArrMs) <= 8 * 3600000;
    });

    if (!covered) {
      gaps.push({
        type:  'from_airport',
        label: savedFlight.arrivalLocation,
        time:  savedFlight.arrivalTime,
        prefill: {
          type:              'taxi',
          departureLocation: savedFlight.arrivalLocation,
          departureTime:     savedFlight.arrivalTime,
        },
      });
    }
  }

  return gaps;
}

// ─── Shared prop interfaces ───────────────────────────────────────────────────
export interface TripInfo {
  origin:      { city: string; iataCode?: string };
  destination: { city: string; iataCode?: string };
  startDate:   string;
  endDate:     string;
}

export interface LogisticsTabProps {
  tripId:      string;
  fabTrigger?: { action: string; seq: number } | null;
  trip:        TripInfo;
}

export type MenuKind = 'transport' | 'accom' | 'venue';