'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Tabs, Tab, TextField,
  Select, MenuItem, FormControl, InputLabel, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, useMediaQuery, useTheme, Alert,
} from '@mui/material';
import AddIcon              from '@mui/icons-material/Add';
import FlightIcon           from '@mui/icons-material/Flight';
import HotelIcon            from '@mui/icons-material/Hotel';
import DescriptionIcon      from '@mui/icons-material/Description';
import MoreVertIcon         from '@mui/icons-material/MoreVert';
import DeleteIcon           from '@mui/icons-material/Delete';
import TrainIcon            from '@mui/icons-material/Train';
import DirectionsBusIcon    from '@mui/icons-material/DirectionsBus';
import DirectionsCarIcon    from '@mui/icons-material/DirectionsCar';
import DirectionsBoatIcon   from '@mui/icons-material/DirectionsBoat';
import LocalTaxiIcon        from '@mui/icons-material/LocalTaxi';
import PedalBikeIcon        from '@mui/icons-material/PedalBike';
import AirportShuttleIcon   from '@mui/icons-material/AirportShuttle';
import PlaceIcon            from '@mui/icons-material/Place';
import MusicNoteIcon        from '@mui/icons-material/MusicNote';
import BusinessIcon         from '@mui/icons-material/Business';
import RestaurantIcon       from '@mui/icons-material/Restaurant';
import SportsSoccerIcon     from '@mui/icons-material/SportsSoccer';
import LaunchIcon           from '@mui/icons-material/Launch';
import AttractionIcon       from '@mui/icons-material/AccountBalance';
import EventIcon            from '@mui/icons-material/Event';
import AirportSearch        from '@/components/ui/AirportSearch';
import AirlineSearch        from '@/components/ui/AirlineSearch';
import AddressSearch        from '@/components/ui/AddressSearch';
import NavigateButton       from '@/components/ui/NavigateButton';
import BookingLinks         from '@/components/logistics/BookingLinks';
import EditIcon from '@mui/icons-material/Edit';

import { saveTripCache, getTripCache, queueAction } from '@/lib/offline/db';
import type { ResolvedAddress } from '@/components/ui/AddressSearch';

interface LogisticsTabProps {
  tripId: string;
  trip: {
    origin:      { city: string; iataCode?: string };
    destination: { city: string; iataCode?: string };
    startDate:   string;
    endDate:     string;
  };
}

// ─── Transport types ──────────────────────────────────────────────────────────
const TRANSPORT_TYPES = [
  { value: 'flight',           label: 'Flight',    Icon: FlightIcon },
  { value: 'train',            label: 'Train',     Icon: TrainIcon },
  { value: 'bus',              label: 'Bus',       Icon: DirectionsBusIcon },
  { value: 'ferry',            label: 'Ferry',     Icon: DirectionsBoatIcon },
  { value: 'car',              label: 'Car',       Icon: DirectionsCarIcon },
  { value: 'car_hire',         label: 'Car hire',  Icon: DirectionsCarIcon },
  { value: 'taxi',             label: 'Taxi',      Icon: LocalTaxiIcon },
  { value: 'private_transfer', label: 'Transfer',  Icon: AirportShuttleIcon },
  { value: 'bicycle',          label: 'Bicycle',   Icon: PedalBikeIcon },
] as const;

type TransportType = typeof TRANSPORT_TYPES[number]['value'];

// Transport types where departure location is a navigable real-world place
const NAVIGABLE_TRANSPORT_TYPES = new Set([
  'train', 'bus', 'ferry', 'car_hire', 'taxi', 'private_transfer',
]);

// ─── Venue types ──────────────────────────────────────────────────────────────
const VENUE_TYPES = [
  { value: 'concert',    label: 'Concert / Gig',  Icon: MusicNoteIcon },
  { value: 'conference', label: 'Conference',     Icon: BusinessIcon },
  { value: 'restaurant', label: 'Restaurant',     Icon: RestaurantIcon },
  { value: 'sports',     label: 'Sports',         Icon: SportsSoccerIcon },
  { value: 'attraction', label: 'Attraction',     Icon: AttractionIcon },
  { value: 'business',   label: 'Business',       Icon: BusinessIcon },
  { value: 'other',      label: 'Other',          Icon: PlaceIcon },
] as const;

type VenueType = typeof VENUE_TYPES[number]['value'];

function venueIcon(type: string, props?: object) {
  const match = VENUE_TYPES.find(v => v.value === type);
  if (!match) return <PlaceIcon {...props} />;
  const { Icon } = match;
  return <Icon {...props} />;
}

function transportIcon(type: string, props?: object) {
  const match = TRANSPORT_TYPES.find(t => t.value === type);
  if (!match) return <FlightIcon {...props} />;
  const { Icon } = match;
  return <Icon {...props} />;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TRANSPORT_STATUSES = ['not_booked', 'pending', 'booked', 'confirmed', 'cancelled'];
const ACCOM_TYPES        = ['hotel', 'airbnb', 'hostel', 'friends_family', 'camping', 'other'];
const RAIL_SUBTYPES      = ['intercity', 'commuter', 'metro', 'tram'];

const STATUS_COLOUR: Record<string, 'default' | 'warning' | 'success' | 'error' | 'primary'> = {
  not_booked: 'default', pending: 'warning', booked: 'primary',
  confirmed: 'success', cancelled: 'error',
};

// ── Blank states — coordinates added for navigable fields ────────────────────
const BLANK_TRANSPORT = {
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
    airline: '', airlineIata: '', flightNumber: '', seat: '', cabin: '',
    operator: '', railSubtype: '',
    rentalCompany: '',
    pickupLocation:      '',
    pickupCoordinates:   null as { lat: number; lng: number } | null,
    dropoffLocation:     '',
    dropoffCoordinates:  null as { lat: number; lng: number } | null,
    vehicle: '',
  },
};

const BLANK_ACCOM = {
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
};

const BLANK_VENUE = {
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

// ─── Label helpers ─────────────────────────────────────────────────────────────
function getTransportLabel(t: any): string {
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

function getTransportSubtitle(t: any): string {
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function LogisticsTab({ tripId, trip }: LogisticsTabProps) {
  const theme  = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [section,       setSection]       = useState(0);
  const [logistics,     setLogistics]     = useState<any>(null);
  const [saving,        setSaving]        = useState(false);

  const [transportOpen, setTransportOpen] = useState(false);
  const [transport,     setTransport]     = useState({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });

  const [accomOpen,     setAccomOpen]     = useState(false);
  const [accom,         setAccom]         = useState({ ...BLANK_ACCOM });

  const [venueOpen,     setVenueOpen]     = useState(false);
  const [venue,         setVenue]         = useState({ ...BLANK_VENUE });

  const [deleteTarget,    setDeleteTarget]    = useState<{ kind: 'transport' | 'accom' | 'venue'; index: number } | null>(null);
const [menuPosition,    setMenuPosition]    = useState<{ top: number; left: number } | null>(null);
const [menuTarget,      setMenuTarget]      = useState<{ kind: 'transport' | 'accom' | 'venue'; index: number } | null>(null);
const [editTransportIdx, setEditTransportIdx] = useState<number | null>(null);
const [editAccomIdx,     setEditAccomIdx]     = useState<number | null>(null);
const [editVenueIdx,     setEditVenueIdx]     = useState<number | null>(null);
  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadLogistics() {
      try {
        const res  = await fetch(`/api/trips/${tripId}/logistics`);
        const data = await res.json();
        setLogistics(data.logistics);
        const cached = await getTripCache(tripId);
        await saveTripCache(tripId, { ...(cached ?? {}), logistics: data.logistics });
      } catch {
        const cached = await getTripCache(tripId);
        if (cached?.logistics) setLogistics(cached.logistics);
      }
    }
    loadLogistics();
  }, [tripId]);

  // ── Saves ──────────────────────────────────────────────────────────────────
const saveTransport = async () => {
  setSaving(true);
  const isEdit = editTransportIdx !== null;
  const updated = {
    ...(logistics ?? {}),
    transportation: isEdit
      ? logistics.transportation.map((t: any, i: number) => i === editTransportIdx ? transport : t)
      : [...(logistics?.transportation ?? []), transport],
  };
  setLogistics(updated);
  await saveTripCache(tripId, { ...(await getTripCache(tripId)), logistics: updated });

  if (!navigator.onLine) {
    await queueAction({ type: isEdit ? 'EDIT_TRANSPORT' : 'ADD_TRANSPORT', tripId, payload: transport, index: editTransportIdx });
    setTransportOpen(false);
    setTransport({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });
    setEditTransportIdx(null);
    setSaving(false);
    return;
  }

  const url    = isEdit ? `/api/trips/${tripId}/logistics/transport/${editTransportIdx}` : `/api/trips/${tripId}/logistics/transport`;
  const method = isEdit ? 'PUT' : 'POST';
  const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transport) });
  const data   = await res.json();
  setLogistics(data.logistics);
  setTransportOpen(false);
  setTransport({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });
  setEditTransportIdx(null);
  setSaving(false);
};

const saveAccom = async () => {
  setSaving(true);
  const isEdit = editAccomIdx !== null;
  const updated = {
    ...(logistics ?? {}),
    accommodation: isEdit
      ? logistics.accommodation.map((a: any, i: number) => i === editAccomIdx ? accom : a)
      : [...(logistics?.accommodation ?? []), accom],
  };
  setLogistics(updated);
  await saveTripCache(tripId, { ...(await getTripCache(tripId)), logistics: updated });

  if (!navigator.onLine) {
    await queueAction({ type: isEdit ? 'EDIT_ACCOM' : 'ADD_ACCOM', tripId, payload: accom, index: editAccomIdx });
    setAccomOpen(false);
    setAccom({ ...BLANK_ACCOM });
    setEditAccomIdx(null);
    setSaving(false);
    return;
  }

  const url    = isEdit ? `/api/trips/${tripId}/logistics/accommodation/${editAccomIdx}` : `/api/trips/${tripId}/logistics/accommodation`;
  const method = isEdit ? 'PUT' : 'POST';
  const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accom) });
  const data   = await res.json();
  setLogistics(data.logistics);
  setAccomOpen(false);
  setAccom({ ...BLANK_ACCOM });
  setEditAccomIdx(null);
  setSaving(false);
};

const saveVenue = async () => {
  setSaving(true);
  const isEdit = editVenueIdx !== null;
  const updated = {
    ...(logistics ?? {}),
    venues: isEdit
      ? (logistics.venues ?? []).map((v: any, i: number) => i === editVenueIdx ? venue : v)
      : [...(logistics?.venues ?? []), venue],
  };
  setLogistics(updated);
  await saveTripCache(tripId, { ...(await getTripCache(tripId)), logistics: updated });

  if (!navigator.onLine) {
    await queueAction({ type: isEdit ? 'EDIT_VENUE' : 'ADD_VENUE', tripId, payload: venue, index: editVenueIdx });
    setVenueOpen(false);
    setVenue({ ...BLANK_VENUE });
    setEditVenueIdx(null);
    setSaving(false);
    return;
  }

  const url    = isEdit ? `/api/trips/${tripId}/logistics/venues/${editVenueIdx}` : `/api/trips/${tripId}/logistics/venues`;
  const method = isEdit ? 'PUT' : 'POST';
  const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(venue) });
  const data   = await res.json();
  setLogistics(data.logistics);
  setVenueOpen(false);
  setVenue({ ...BLANK_VENUE });
  setEditVenueIdx(null);
  setSaving(false);
};

  // ── Deletes ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { kind, index } = deleteTarget;

    const updated = {
      ...(logistics ?? {}),
      transportation: kind === 'transport'
        ? logistics.transportation.filter((_: any, i: number) => i !== index)
        : logistics.transportation,
      accommodation: kind === 'accom'
        ? logistics.accommodation.filter((_: any, i: number) => i !== index)
        : logistics.accommodation,
      venues: kind === 'venue'
        ? (logistics.venues ?? []).filter((_: any, i: number) => i !== index)
        : (logistics.venues ?? []),
    };

    setLogistics(updated);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), logistics: updated });

    if (!navigator.onLine) {
      await queueAction({ type: 'DELETE_LOGISTICS_ITEM', tripId, payload: { kind, index } });
      setDeleteTarget(null);
      return;
    }

    const urlMap = {
      transport: `/api/trips/${tripId}/logistics/transport/${index}`,
      accom:     `/api/trips/${tripId}/logistics/accommodation/${index}`,
      venue:     `/api/trips/${tripId}/logistics/venues/${index}`,
    };

    const res  = await fetch(urlMap[kind], { method: 'DELETE' });
    const data = await res.json();
    setLogistics(data.logistics);
    setDeleteTarget(null);
  };

const openMenu = (e: React.MouseEvent<HTMLElement>, kind: 'transport' | 'accom' | 'venue', index: number) => {
  e.stopPropagation();
  const rect = e.currentTarget.getBoundingClientRect();
  setMenuPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
  setMenuTarget({ kind, index });
};
const closeMenu = () => { setMenuPosition(null); setMenuTarget(null); };

const openEdit = () => {
  if (!menuTarget) return;
  const { kind, index } = menuTarget;
if (kind === 'transport') {
  const t = logistics.transportation[index];
  const merged = {
    ...BLANK_TRANSPORT,
    ...t,
    details: { ...BLANK_TRANSPORT.details, ...(t.details ?? {}) },
  };
  setTransport(merged);
  setEditTransportIdx(index);
  setTransportOpen(true);
  } else if (kind === 'accom') {
    setAccom({ ...BLANK_ACCOM, ...logistics.accommodation[index] });
    setEditAccomIdx(index);
    setAccomOpen(true);
  } else if (kind === 'venue') {
    setVenue({ ...BLANK_VENUE, ...logistics.venues[index] });
    setEditVenueIdx(index);
    setVenueOpen(true);
  }
  closeMenu();
};
  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtDateTime = (dt: string) =>
    dt ? new Date(dt).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-IE', { dateStyle: 'medium' }) : '';

  const setDetail = (key: string, val: any) =>
    setTransport(p => ({ ...p, details: { ...p.details, [key]: val } }));

  const changeType = (newType: TransportType) =>
    setTransport(p => ({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details }, type: newType, status: p.status }));

  // ── Transport form fields ──────────────────────────────────────────────────
  const TransportFields = () => {
    const type = transport.type;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {type === 'flight' && (<>
          <AirlineSearch label="Airline" value={transport.details.airline}
            onChange={a => { setDetail('airline', a.name); setDetail('airlineIata', a.iata); }} />
          <TextField label="Flight number" fullWidth placeholder="FR 328"
            value={transport.details.flightNumber}
            onChange={e => setDetail('flightNumber', e.target.value)} />
          <AirportSearch label="From (airport)" value={transport.departureLocation}
            onChange={a => setTransport(p => ({ ...p, departureLocation: `${a.iata} — ${a.city}` }))} />
          <AirportSearch label="To (airport)" value={transport.arrivalLocation}
            onChange={a => setTransport(p => ({ ...p, arrivalLocation: `${a.iata} — ${a.city}` }))} />
          <TextField label="Seat" fullWidth placeholder="14A"
            value={transport.details.seat} onChange={e => setDetail('seat', e.target.value)} />
          <FormControl fullWidth>
            <InputLabel>Cabin class</InputLabel>
            <Select value={transport.details.cabin} label="Cabin class"
              onChange={e => setDetail('cabin', e.target.value)}>
              {['Economy', 'Premium economy', 'Business', 'First'].map(c => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </>)}

        {type === 'train' && (<>
          <TextField label="Operator" fullWidth placeholder="Irish Rail, Eurostar, DB…"
            value={transport.details.operator} onChange={e => setDetail('operator', e.target.value)} />
          <FormControl fullWidth>
            <InputLabel>Rail type</InputLabel>
            <Select value={transport.details.railSubtype} label="Rail type"
              onChange={e => setDetail('railSubtype', e.target.value)}>
              {RAIL_SUBTYPES.map(r => (
                <MenuItem key={r} value={r} sx={{ textTransform: 'capitalize' }}>{r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <AddressSearch
            label="From (station)" value={transport.departureLocation}
            placeholder="Dublin Heuston"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              departureLocation:    r?.address     ?? '',
              departureCoordinates: r?.coordinates ?? null,
            }))}
          />
          <AddressSearch
            label="To (station)" value={transport.arrivalLocation}
            placeholder="Belfast Great Victoria St"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              arrivalLocation:    r?.address     ?? '',
              arrivalCoordinates: r?.coordinates ?? null,
            }))}
          />
          <TextField label="Seat / coach" fullWidth placeholder="Coach B, Seat 42"
            value={transport.details.seat} onChange={e => setDetail('seat', e.target.value)} />
        </>)}

        {type === 'bus' && (<>
          <TextField label="Operator" fullWidth placeholder="Bus Éireann, Aircoach…"
            value={transport.details.operator} onChange={e => setDetail('operator', e.target.value)} />
          <AddressSearch
            label="From (stop / station)" value={transport.departureLocation}
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              departureLocation:    r?.address     ?? '',
              departureCoordinates: r?.coordinates ?? null,
            }))}
          />
          <AddressSearch
            label="To (stop / station)" value={transport.arrivalLocation}
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              arrivalLocation:    r?.address     ?? '',
              arrivalCoordinates: r?.coordinates ?? null,
            }))}
          />
          <TextField label="Seat" fullWidth value={transport.details.seat}
            onChange={e => setDetail('seat', e.target.value)} />
        </>)}

        {type === 'ferry' && (<>
          <TextField label="Operator" fullWidth placeholder="Stena Line, Irish Ferries…"
            value={transport.details.operator} onChange={e => setDetail('operator', e.target.value)} />
          <AddressSearch
            label="From (port)" value={transport.departureLocation}
            placeholder="Dublin Port"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              departureLocation:    r?.address     ?? '',
              departureCoordinates: r?.coordinates ?? null,
            }))}
          />
          <AddressSearch
            label="To (port)" value={transport.arrivalLocation}
            placeholder="Holyhead"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              arrivalLocation:    r?.address     ?? '',
              arrivalCoordinates: r?.coordinates ?? null,
            }))}
          />
          <FormControl fullWidth>
            <InputLabel>Cabin</InputLabel>
            <Select value={transport.details.cabin} label="Cabin"
              onChange={e => setDetail('cabin', e.target.value)}>
              {['No cabin (seat only)', 'Inside cabin', 'Outside cabin', 'Premium cabin'].map(c => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </>)}

        {type === 'car' && (<>
          <TextField label="From" fullWidth placeholder="Home / Dublin"
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))} />
          <TextField label="To" fullWidth placeholder="Dublin Airport"
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))} />
          <TextField label="Vehicle (optional)" fullWidth placeholder="Tesla Model 3"
            value={transport.details.vehicle} onChange={e => setDetail('vehicle', e.target.value)} />
        </>)}

        {type === 'car_hire' && (<>
          <TextField label="Rental company" fullWidth placeholder="Hertz, Avis, Enterprise…"
            value={transport.details.rentalCompany}
            onChange={e => setDetail('rentalCompany', e.target.value)} />
          <AddressSearch
            label="Pickup location" value={transport.details.pickupLocation}
            placeholder="OTP Airport Terminal 1"
            onChange={(r: ResolvedAddress | null) => {
              setDetail('pickupLocation',    r?.address     ?? '');
              setDetail('pickupCoordinates', r?.coordinates ?? null);
              setTransport(p => ({
                ...p,
                departureLocation:    r?.address     ?? '',
                departureCoordinates: r?.coordinates ?? null,
              }));
            }}
          />
          <AddressSearch
            label="Drop-off location" value={transport.details.dropoffLocation}
            placeholder="Same / City centre"
            onChange={(r: ResolvedAddress | null) => {
              setDetail('dropoffLocation',    r?.address     ?? '');
              setDetail('dropoffCoordinates', r?.coordinates ?? null);
              setTransport(p => ({
                ...p,
                arrivalLocation:    r?.address     ?? '',
                arrivalCoordinates: r?.coordinates ?? null,
              }));
            }}
          />
          <TextField label="Vehicle class (optional)" fullWidth placeholder="Economy, SUV…"
            value={transport.details.vehicle} onChange={e => setDetail('vehicle', e.target.value)} />
        </>)}

        {type === 'taxi' && (<>
          <AddressSearch
            label="From" value={transport.departureLocation}
            placeholder="OTP Airport"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              departureLocation:    r?.address     ?? '',
              departureCoordinates: r?.coordinates ?? null,
            }))}
          />
          <AddressSearch
            label="To" value={transport.arrivalLocation}
            placeholder="Hotel / City centre"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              arrivalLocation:    r?.address     ?? '',
              arrivalCoordinates: r?.coordinates ?? null,
            }))}
          />
          <TextField label="Operator (optional)" fullWidth placeholder="Bolt, Free Now…"
            value={transport.details.operator} onChange={e => setDetail('operator', e.target.value)} />
        </>)}

        {type === 'private_transfer' && (<>
          <AddressSearch
            label="From" value={transport.departureLocation}
            placeholder="OTP Airport"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              departureLocation:    r?.address     ?? '',
              departureCoordinates: r?.coordinates ?? null,
            }))}
          />
          <AddressSearch
            label="To" value={transport.arrivalLocation}
            placeholder="Hotel"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              arrivalLocation:    r?.address     ?? '',
              arrivalCoordinates: r?.coordinates ?? null,
            }))}
          />
          <TextField label="Operator / provider" fullWidth placeholder="Company or driver name"
            value={transport.details.operator} onChange={e => setDetail('operator', e.target.value)} />
          <TextField label="Vehicle (optional)" fullWidth placeholder="Mercedes E-Class"
            value={transport.details.vehicle} onChange={e => setDetail('vehicle', e.target.value)} />
        </>)}

        {type === 'bicycle' && (<>
          <TextField label="From" fullWidth value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))} />
          <TextField label="To" fullWidth value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))} />
        </>)}

        {/* Common fields */}
        <TextField label="Departure date & time" type="datetime-local"
          value={transport.departureTime}
          onChange={e => setTransport(p => ({ ...p, departureTime: e.target.value }))}
          fullWidth InputLabelProps={{ shrink: true }} />
        <TextField label="Arrival date & time" type="datetime-local"
          value={transport.arrivalTime}
          onChange={e => setTransport(p => ({ ...p, arrivalTime: e.target.value }))}
          fullWidth InputLabelProps={{ shrink: true }} />
        {!['car', 'bicycle', 'taxi'].includes(type) && (
          <TextField label="Confirmation ref" fullWidth value={transport.confirmationNumber}
            onChange={e => setTransport(p => ({ ...p, confirmationNumber: e.target.value }))} />
        )}
        <TextField label="Cost (€)" type="number" fullWidth value={transport.cost}
          onChange={e => setTransport(p => ({ ...p, cost: e.target.value }))} />
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select value={transport.status} label="Status"
            onChange={e => setTransport(p => ({ ...p, status: e.target.value }))}>
            {TRANSPORT_STATUSES.map(s => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField label="Notes" fullWidth multiline rows={2} value={transport.notes}
          onChange={e => setTransport(p => ({ ...p, notes: e.target.value }))} />
      </Box>
    );
  };

  // ── Transport card ─────────────────────────────────────────────────────────
  const TransportCard = ({ t, i }: { t: any; i: number }) => {
    const isNavigable = NAVIGABLE_TRANSPORT_TYPES.has(t.type);
    const navDest = isNavigable ? {
      name:        getTransportLabel(t),
      address:     t.departureLocation ?? t.details?.pickupLocation ?? '',
      coordinates: t.departureCoordinates ?? t.details?.pickupCoordinates ?? null,
    } : null;

    return (
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}>
            {transportIcon(t.type, { fontSize: 'medium' })}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>
              {getTransportLabel(t)}
            </Typography>
            {getTransportSubtitle(t) && (
              <Typography variant="body2" color="text.secondary">{getTransportSubtitle(t)}</Typography>
            )}
            {(t.departureTime || t.arrivalTime) && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t.departureTime ? fmtDateTime(t.departureTime) : ''}
                {t.arrivalTime   ? ` → ${fmtDateTime(t.arrivalTime)}` : ''}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              {(t.details?.seat ?? t.seat) && (
                <Typography variant="caption" color="text.secondary">
                  Seat {t.details?.seat ?? t.seat}
                </Typography>
              )}
              {t.confirmationNumber && (
                <Typography variant="caption" color="text.secondary">Ref: {t.confirmationNumber}</Typography>
              )}
              {t.cost && <Typography variant="caption" color="text.secondary">€{t.cost}</Typography>}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            <Chip label={t.status.replace('_', ' ')} color={STATUS_COLOUR[t.status]} size="medium"
              sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'capitalize' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {navDest && (
                <NavigateButton destination={navDest} suggestedMode="driving" size="medium" />
              )}
              <IconButton size="medium" onClick={e => openMenu(e, 'transport', i)}>
                <MoreVertIcon fontSize="medium" />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  };

  // ── Accommodation card ─────────────────────────────────────────────────────
  const AccomCard = ({ a, i }: { a: any; i: number }) => (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <HotelIcon color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>{a.name}</Typography>
          {a.address && <Typography variant="body2" color="text.secondary">{a.address}</Typography>}
          {(a.checkIn || a.checkOut) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {fmtDate(a.checkIn)} → {fmtDate(a.checkOut)}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
            {a.confirmationNumber && (
              <Typography variant="caption" color="text.secondary">Ref: {a.confirmationNumber}</Typography>
            )}
            {a.cost && <Typography variant="caption" color="text.secondary">€{a.cost}</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
          <Chip label={a.status.replace('_', ' ')} color={STATUS_COLOUR[a.status]} size="medium"
            sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'capitalize' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NavigateButton
              destination={{ name: a.name, address: a.address, coordinates: a.coordinates ?? null }}
              suggestedMode="driving"
              size="medium"
            />
            <IconButton size="medium" onClick={e => openMenu(e, 'accom', i)}>
              <MoreVertIcon fontSize="medium" />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Paper>
  );

  // ── Venue card ─────────────────────────────────────────────────────────────
  const VenueCard = ({ v, i }: { v: any; i: number }) => {
    const venueTypeLabel = VENUE_TYPES.find(vt => vt.value === v.type)?.label ?? 'Venue';
    return (
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}>
            {venueIcon(v.type, { fontSize: 'medium' })}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>{v.name || venueTypeLabel}</Typography>
            {v.address && <Typography variant="body2" color="text.secondary">{v.address}</Typography>}
            {v.date && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {fmtDate(v.date)}
                {v.time    ? ` · ${v.time}`    : ''}
                {v.endTime ? ` → ${v.endTime}` : ''}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              <Chip label={venueTypeLabel} size="medium" variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }} />
              {v.confirmationNumber && (
                <Typography variant="caption" color="text.secondary">Ref: {v.confirmationNumber}</Typography>
              )}
              {v.cost && <Typography variant="caption" color="text.secondary">€{v.cost}</Typography>}
              {v.website && (
                <Chip
                  label="Website"
                  size="medium"
                  component="a"
                  href={v.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  icon={<LaunchIcon sx={{ fontSize: '0.75rem !important' }} />}
                  sx={{ fontSize: '0.65rem', height: 24 }}
                />
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            <Chip label={v.status.replace('_', ' ')} color={STATUS_COLOUR[v.status]} size="medium"
              sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'capitalize' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <NavigateButton
                destination={{ name: v.name, address: v.address, coordinates: v.coordinates ?? null }}
                suggestedMode="walking"
                size="medium"
              />
              <IconButton size="medium" onClick={e => openMenu(e, 'venue', i)}>
                <MoreVertIcon fontSize="medium" />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Section tabs ── */}
      <Tabs
        value={section}
        onChange={(_, v) => setSection(v)}
        variant="fullWidth"
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            minHeight: { xs: 60, sm: 52 },
            flexDirection: 'column',
            gap: 0.5,
            fontSize: { xs: '0.65rem', sm: '0.72rem' },
            fontWeight: 600,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tab label="Transport"     icon={<FlightIcon />}       iconPosition="top" />
        <Tab label="Accommodation" icon={<HotelIcon />}        iconPosition="top" />
        <Tab label="Venues"        icon={<EventIcon />}        iconPosition="top" />
        <Tab label="Documents"     icon={<DescriptionIcon />}  iconPosition="top" />
      </Tabs>

      {/* ── Transport ── */}
      {section === 0 && (
        <Box>
          <BookingLinks
            originIata={trip.origin?.iataCode}
            destIata={trip.destination?.iataCode}
            originCity={trip.origin?.city ?? ''}
            destCity={trip.destination?.city ?? ''}
            startDate={trip.startDate}
            endDate={trip.endDate}
          />
          {(logistics?.transportation ?? []).map((t: any, i: number) => (
            <TransportCard key={i} t={t} i={i} />
          ))}
          {(!logistics?.transportation || logistics.transportation.length === 0) && (
            <Alert severity="info" sx={{ mb: 2 }}>No transport added yet.</Alert>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setTransportOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'} sx={{ py: mobile ? 1.5 : 1 }}>
            Add transport
          </Button>
        </Box>
      )}

      {/* ── Accommodation ── */}
      {section === 1 && (
        <Box>
          {(logistics?.accommodation ?? []).map((a: any, i: number) => (
            <AccomCard key={i} a={a} i={i} />
          ))}
          {(!logistics?.accommodation || logistics.accommodation.length === 0) && (
            <Alert severity="info" sx={{ mb: 2 }}>No accommodation added yet.</Alert>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAccomOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'} sx={{ py: mobile ? 1.5 : 1 }}>
            Add accommodation
          </Button>
        </Box>
      )}

      {/* ── Venues ── */}
      {section === 2 && (
        <Box>
          {(logistics?.venues ?? []).map((v: any, i: number) => (
            <VenueCard key={i} v={v} i={i} />
          ))}
          {(!logistics?.venues || logistics.venues.length === 0) && (
            <Alert severity="info" sx={{ mb: 2 }}>No venues added yet.</Alert>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setVenueOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'} sx={{ py: mobile ? 1.5 : 1 }}>
            Add venue
          </Button>
        </Box>
      )}

      {/* ── Documents ── */}
      {section === 3 && (
        <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>Documents</Typography>
          <Typography variant="body2" color="text.secondary">
            Passport, visa, and insurance tracking coming soon.
          </Typography>
        </Paper>
      )}

      {/* ── Context menu ── */}
     <Menu
  anchorReference="anchorPosition"
  anchorPosition={menuPosition ?? undefined}
  open={Boolean(menuPosition)}
  onClose={closeMenu}
>
<MenuItem onClick={openEdit} sx={{ gap: 1 }}>
  <EditIcon fontSize="small" /> Edit
</MenuItem>
  <MenuItem onClick={() => { setDeleteTarget(menuTarget); closeMenu(); }} sx={{ color: 'error.main', gap: 1 }}>
    <DeleteIcon fontSize="medium" /> Delete
  </MenuItem>
</Menu>

      {/* ── Delete confirmation ── */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle fontWeight={700}>Delete this item?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add transport dialog ── */}
      <Dialog open={transportOpen} onClose={() => setTransportOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}>
        <DialogTitle fontWeight={700}>{editTransportIdx !== null ? 'Edit Transport' : 'Add Transport'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}
                sx={{ display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                Type
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {TRANSPORT_TYPES.map(({ value, label, Icon }) => (
                  <Chip key={value} icon={<Icon sx={{ fontSize: '1rem !important' }} />} label={label}
                    onClick={() => changeType(value)}
                    variant={transport.type === value ? 'filled' : 'outlined'}
                    color={transport.type === value ? 'primary' : 'default'}
                    sx={{ fontWeight: transport.type === value ? 700 : 400 }} />
                ))}
              </Box>
            </Box>
            {TransportFields()}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setTransportOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveTransport} disabled={saving} fullWidth={mobile} size="large">Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add accommodation dialog ── */}
      <Dialog open={accomOpen} onClose={() => setAccomOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}>
        <DialogTitle fontWeight={700}>{editAccomIdx !== null ? 'Edit Accommodation' : 'Add Accommodation'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={accom.type} label="Type"
                onChange={e => setAccom(p => ({ ...p, type: e.target.value }))}>
                {ACCOM_TYPES.map(t => (
                  <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace('_', '/')}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Name" fullWidth placeholder="Hotel Intercontinental"
              value={accom.name} onChange={e => setAccom(p => ({ ...p, name: e.target.value }))} />
            <AddressSearch
              label="Address"
              value={accom.address}
              placeholder="Search for the hotel or property address…"
              onChange={(r: ResolvedAddress | null) => setAccom(p => ({
                ...p,
                address:         r?.address     ?? '',
                coordinates:     r?.coordinates ?? null,
                addressVerified: !!r,
              }))}
            />
            <TextField label="Check in" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={accom.checkIn} onChange={e => setAccom(p => ({ ...p, checkIn: e.target.value }))} />
            <TextField label="Check out" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={accom.checkOut} onChange={e => setAccom(p => ({ ...p, checkOut: e.target.value }))} />
            <TextField label="Confirmation ref" fullWidth value={accom.confirmationNumber}
              onChange={e => setAccom(p => ({ ...p, confirmationNumber: e.target.value }))} />
            <TextField label="Cost (€)" type="number" fullWidth value={accom.cost}
              onChange={e => setAccom(p => ({ ...p, cost: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={accom.status} label="Status"
                onChange={e => setAccom(p => ({ ...p, status: e.target.value }))}>
                {TRANSPORT_STATUSES.map(s => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Notes" fullWidth multiline rows={2} value={accom.notes}
              onChange={e => setAccom(p => ({ ...p, notes: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setAccomOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveAccom} disabled={saving} fullWidth={mobile} size="large">
            Save accommodation
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add venue dialog ── */}
      <Dialog open={venueOpen} onClose={() => setVenueOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}>
       <DialogTitle fontWeight={700}>{editVenueIdx !== null ? 'Edit Venue' : 'Add Venue'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}
                sx={{ display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                Type
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {VENUE_TYPES.map(({ value, label, Icon }) => (
                  <Chip key={value} icon={<Icon sx={{ fontSize: '1rem !important' }} />} label={label}
                    onClick={() => setVenue(p => ({ ...p, type: value }))}
                    variant={venue.type === value ? 'filled' : 'outlined'}
                    color={venue.type === value ? 'primary' : 'default'}
                    sx={{ fontWeight: venue.type === value ? 700 : 400 }} />
                ))}
              </Box>
            </Box>
            <TextField label="Venue name" fullWidth placeholder="3Arena, RDS, The Workman's Club…"
              value={venue.name} onChange={e => setVenue(p => ({ ...p, name: e.target.value }))} />
            <AddressSearch
              label="Address"
              value={venue.address}
              placeholder="East Link Bridge, North Wall Quay…"
              onChange={(r: ResolvedAddress | null) => setVenue(p => ({
                ...p,
                address:     r?.address     ?? '',
                coordinates: r?.coordinates ?? null,
              }))}
            />
            <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={venue.date} onChange={e => setVenue(p => ({ ...p, date: e.target.value }))} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Start time" type="time" fullWidth InputLabelProps={{ shrink: true }}
                value={venue.time} onChange={e => setVenue(p => ({ ...p, time: e.target.value }))} />
              <TextField label="End time (optional)" type="time" fullWidth InputLabelProps={{ shrink: true }}
                value={venue.endTime} onChange={e => setVenue(p => ({ ...p, endTime: e.target.value }))} />
            </Box>
            <TextField label="Ticket / confirmation ref" fullWidth
              value={venue.confirmationNumber}
              onChange={e => setVenue(p => ({ ...p, confirmationNumber: e.target.value }))} />
            <TextField label="Cost (€)" type="number" fullWidth value={venue.cost}
              onChange={e => setVenue(p => ({ ...p, cost: e.target.value }))} />
            <TextField label="Website (optional)" fullWidth placeholder="https://3arena.ie"
              value={venue.website} onChange={e => setVenue(p => ({ ...p, website: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={venue.status} label="Status"
                onChange={e => setVenue(p => ({ ...p, status: e.target.value }))}>
                {TRANSPORT_STATUSES.map(s => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Notes" fullWidth multiline rows={2} value={venue.notes}
              onChange={e => setVenue(p => ({ ...p, notes: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setVenueOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveVenue} disabled={saving} fullWidth={mobile} size="large">
            Save venue
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}