'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Tabs, Tab, TextField,
  Select, MenuItem, FormControl, InputLabel, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, useMediaQuery, useTheme, Alert, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import AddIcon          from '@mui/icons-material/Add';
import FlightIcon       from '@mui/icons-material/Flight';
import HotelIcon        from '@mui/icons-material/Hotel';
import DescriptionIcon  from '@mui/icons-material/Description';
import MoreVertIcon     from '@mui/icons-material/MoreVert';
import DeleteIcon       from '@mui/icons-material/Delete';
import TrainIcon        from '@mui/icons-material/Train';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import LocalTaxiIcon    from '@mui/icons-material/LocalTaxi';
import PedalBikeIcon    from '@mui/icons-material/PedalBike';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import AirportSearch    from '@/components/ui/AirportSearch';
import AirlineSearch    from '@/components/ui/AirlineSearch';
import { saveTripCache, getTripCache, queueAction } from '@/lib/offline/db';

interface LogisticsTabProps { tripId: string; }

// ─── Transport types ──────────────────────────────────────────────────────────
const TRANSPORT_TYPES = [
  { value: 'flight',           label: 'Flight',           Icon: FlightIcon },
  { value: 'train',            label: 'Train',            Icon: TrainIcon },
  { value: 'bus',              label: 'Bus',              Icon: DirectionsBusIcon },
  { value: 'ferry',            label: 'Ferry',            Icon: DirectionsBoatIcon },
  { value: 'car',              label: 'Car',              Icon: DirectionsCarIcon },
  { value: 'car_hire',         label: 'Car hire',         Icon: DirectionsCarIcon },
  { value: 'taxi',             label: 'Taxi',             Icon: LocalTaxiIcon },
  { value: 'private_transfer', label: 'Transfer',         Icon: AirportShuttleIcon },
  { value: 'bicycle',          label: 'Bicycle',          Icon: PedalBikeIcon },
] as const;

type TransportType = typeof TRANSPORT_TYPES[number]['value'];

function transportIcon(type: string, props?: object) {
  const match = TRANSPORT_TYPES.find(t => t.value === type);
  if (!match) return <FlightIcon {...props} />;
  const { Icon } = match;
  return <Icon {...props} />;
}

// Generate the card headline based on mode and record fields
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
      const op   = t.details?.operator ?? '';
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
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
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
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
    case 'flight':
      return t.details?.airline ?? t.airline ?? '';
    case 'train':
    case 'bus':
    case 'ferry':
      return t.details?.operator ?? '';
    case 'car_hire':
      return t.details?.vehicle ?? '';
    case 'taxi':
    case 'private_transfer':
      return t.details?.operator ?? '';
    default:
      return '';
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TRANSPORT_STATUSES = ['not_booked', 'pending', 'booked', 'confirmed', 'cancelled'];
const ACCOM_TYPES        = ['hotel', 'airbnb', 'hostel', 'friends_family', 'camping', 'other'];
const RAIL_SUBTYPES      = ['intercity', 'commuter', 'metro', 'tram'];

const STATUS_COLOUR: Record<string, 'default' | 'warning' | 'success' | 'error' | 'primary'> = {
  not_booked: 'default', pending: 'warning', booked: 'primary',
  confirmed: 'success', cancelled: 'error',
};

const BLANK_TRANSPORT = {
  type:               'flight' as TransportType,
  status:             'not_booked',
  departureLocation:  '',
  arrivalLocation:    '',
  departureTime:      '',
  arrivalTime:        '',
  confirmationNumber: '',
  cost:               '',
  notes:              '',
  details: {
    // flight
    airline: '', airlineIata: '', flightNumber: '', seat: '', cabin: '',
    // train / bus / ferry
    operator: '', railSubtype: '',
    // car hire
    rentalCompany: '', pickupLocation: '', dropoffLocation: '', vehicle: '',
  },
};

const BLANK_ACCOM = {
  type: 'hotel', status: 'not_booked', name: '', address: '',
  checkIn: '', checkOut: '', confirmationNumber: '', cost: '', notes: '',
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function LogisticsTab({ tripId }: LogisticsTabProps) {
  const theme  = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [section,       setSection]       = useState(0);
  const [logistics,     setLogistics]     = useState<any>(null);
  const [saving,        setSaving]        = useState(false);

  const [transportOpen, setTransportOpen] = useState(false);
  const [transport,     setTransport]     = useState({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });

  const [accomOpen,     setAccomOpen]     = useState(false);
  const [accom,         setAccom]         = useState({ ...BLANK_ACCOM });

  const [deleteTarget,  setDeleteTarget]  = useState<{ kind: 'transport' | 'accom'; index: number } | null>(null);
  const [menuAnchor,    setMenuAnchor]    = useState<null | HTMLElement>(null);
  const [menuTarget,    setMenuTarget]    = useState<{ kind: 'transport' | 'accom'; index: number } | null>(null);

useEffect(() => {
  async function loadLogistics() {
    try {
      const res = await fetch(`/api/trips/${tripId}/logistics`);
      const data = await res.json();

      setLogistics(data.logistics);

      const cached = await getTripCache(tripId);
      await saveTripCache(tripId, {
        ...(cached ?? {}),
        logistics: data.logistics,
      });

    } catch {
      const cached = await getTripCache(tripId);
      if (cached?.logistics) {
        setLogistics(cached.logistics);
      }
    }
  }

  loadLogistics();
}, [tripId]);

  // ── Saves ──────────────────────────────────────────────────────────────────
const saveTransport = async () => {
  setSaving(true);

  const updated = {
    ...(logistics ?? {}),
    transportation: [
      ...(logistics?.transportation ?? []),
      transport,
    ],
  };

  setLogistics(updated);

  await saveTripCache(tripId, {
    ...(await getTripCache(tripId)),
    logistics: updated,
  });

  if (!navigator.onLine) {
    await queueAction({
      type: 'ADD_TRANSPORT',
      tripId,
      payload: transport,
    });
    setTransportOpen(false);
    setTransport({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });
    setSaving(false);
    return;
  }

  const res = await fetch(`/api/trips/${tripId}/logistics/transport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transport),
  });

  const data = await res.json();
  setLogistics(data.logistics);

  setTransportOpen(false);
  setTransport({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });
  setSaving(false);
};

const saveAccom = async () => {
  setSaving(true);

  const updated = {
    ...(logistics ?? {}),
    accommodation: [
      ...(logistics?.accommodation ?? []),
      accom,
    ],
  };

  setLogistics(updated);

  await saveTripCache(tripId, {
    ...(await getTripCache(tripId)),
    logistics: updated,
  });

  if (!navigator.onLine) {
    await queueAction({
      type: 'ADD_ACCOM',
      tripId,
      payload: accom,
    });
    setAccomOpen(false);
    setAccom({ ...BLANK_ACCOM });
    setSaving(false);
    return;
  }

  const res = await fetch(`/api/trips/${tripId}/logistics/accommodation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(accom),
  });

  const data = await res.json();
  setLogistics(data.logistics);

  setAccomOpen(false);
  setAccom({ ...BLANK_ACCOM });
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
  };

  setLogistics(updated);

  await saveTripCache(tripId, {
    ...(await getTripCache(tripId)),
    logistics: updated,
  });

  if (!navigator.onLine) {
    await queueAction({
      type: 'DELETE_LOGISTICS_ITEM',
      tripId,
      payload: { kind, index },
    });
    setDeleteTarget(null);
    return;
  }

  const url = kind === 'transport'
    ? `/api/trips/${tripId}/logistics/transport/${index}`
    : `/api/trips/${tripId}/logistics/accommodation/${index}`;

  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  setLogistics(data.logistics);
  setDeleteTarget(null);
};

  const openMenu = (e: React.MouseEvent<HTMLElement>, kind: 'transport' | 'accom', index: number) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuTarget({ kind, index });
  };
  const closeMenu = () => { setMenuAnchor(null); setMenuTarget(null); };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtDateTime = (dt: string) =>
    dt ? new Date(dt).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-IE', { dateStyle: 'medium' }) : '';

  const setDetail = (key: string, val: string) =>
    setTransport(p => ({ ...p, details: { ...p.details, [key]: val } }));

  const changeType = (newType: TransportType) =>
    setTransport(p => ({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details }, type: newType, status: p.status }));

  // ── Dynamic form fields per transport type ─────────────────────────────────
  const TransportFields = () => {
    const type = transport.type;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* ── FLIGHT ── */}
        {type === 'flight' && (<>
          <AirlineSearch
            label="Airline"
            value={transport.details.airline}
            onChange={a => {
              setDetail('airline', a.name);
              setDetail('airlineIata', a.iata);
            }}
          />
          <TextField
            label="Flight number" fullWidth placeholder="FR 328"
            value={transport.details.flightNumber}
            onChange={e => setDetail('flightNumber', e.target.value)}
          />
          <AirportSearch
            label="From (airport)"
            value={transport.departureLocation}
            onChange={a => setTransport(p => ({
              ...p,
              departureLocation: `${a.iata} — ${a.city}`,
            }))}
          />
          <AirportSearch
            label="To (airport)"
            value={transport.arrivalLocation}
            onChange={a => setTransport(p => ({
              ...p,
              arrivalLocation: `${a.iata} — ${a.city}`,
            }))}
          />
          <TextField
            label="Seat" fullWidth placeholder="14A"
            value={transport.details.seat}
            onChange={e => setDetail('seat', e.target.value)}
          />
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

        {/* ── TRAIN ── */}
        {type === 'train' && (<>
          <TextField
            label="Operator" fullWidth placeholder="Irish Rail, Eurostar, DB…"
            value={transport.details.operator}
            onChange={e => setDetail('operator', e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel>Rail type</InputLabel>
            <Select value={transport.details.railSubtype} label="Rail type"
              onChange={e => setDetail('railSubtype', e.target.value)}>
              {RAIL_SUBTYPES.map(r => (
                <MenuItem key={r} value={r} sx={{ textTransform: 'capitalize' }}>{r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="From (station)" fullWidth placeholder="Dublin Heuston"
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))}
          />
          <TextField
            label="To (station)" fullWidth placeholder="Belfast Great Victoria St"
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))}
          />
          <TextField
            label="Seat / coach" fullWidth placeholder="Coach B, Seat 42"
            value={transport.details.seat}
            onChange={e => setDetail('seat', e.target.value)}
          />
        </>)}

        {/* ── BUS ── */}
        {type === 'bus' && (<>
          <TextField
            label="Operator" fullWidth placeholder="Bus Éireann, Aircoach…"
            value={transport.details.operator}
            onChange={e => setDetail('operator', e.target.value)}
          />
          <TextField
            label="From (stop / station)" fullWidth
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))}
          />
          <TextField
            label="To (stop / station)" fullWidth
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))}
          />
          <TextField
            label="Seat" fullWidth
            value={transport.details.seat}
            onChange={e => setDetail('seat', e.target.value)}
          />
        </>)}

        {/* ── FERRY ── */}
        {type === 'ferry' && (<>
          <TextField
            label="Operator" fullWidth placeholder="Stena Line, Irish Ferries…"
            value={transport.details.operator}
            onChange={e => setDetail('operator', e.target.value)}
          />
          <TextField
            label="From (port)" fullWidth placeholder="Dublin Port"
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))}
          />
          <TextField
            label="To (port)" fullWidth placeholder="Holyhead"
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))}
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

        {/* ── CAR (own) ── */}
        {type === 'car' && (<>
          <TextField
            label="From" fullWidth placeholder="Home / Dublin"
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))}
          />
          <TextField
            label="To" fullWidth placeholder="Dublin Airport"
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))}
          />
          <TextField
            label="Vehicle (optional)" fullWidth placeholder="Tesla Model 3"
            value={transport.details.vehicle}
            onChange={e => setDetail('vehicle', e.target.value)}
          />
        </>)}

        {/* ── CAR HIRE ── */}
        {type === 'car_hire' && (<>
          <TextField
            label="Rental company" fullWidth placeholder="Hertz, Avis, Enterprise…"
            value={transport.details.rentalCompany}
            onChange={e => setDetail('rentalCompany', e.target.value)}
          />
          <TextField
            label="Pickup location" fullWidth placeholder="OTP Airport Terminal 1"
            value={transport.details.pickupLocation}
            onChange={e => {
              setDetail('pickupLocation', e.target.value);
              setTransport(p => ({ ...p, departureLocation: e.target.value }));
            }}
          />
          <TextField
            label="Drop-off location" fullWidth placeholder="Same / City centre"
            value={transport.details.dropoffLocation}
            onChange={e => {
              setDetail('dropoffLocation', e.target.value);
              setTransport(p => ({ ...p, arrivalLocation: e.target.value }));
            }}
          />
          <TextField
            label="Vehicle class (optional)" fullWidth placeholder="Economy, SUV…"
            value={transport.details.vehicle}
            onChange={e => setDetail('vehicle', e.target.value)}
          />
        </>)}

        {/* ── TAXI ── */}
        {type === 'taxi' && (<>
          <TextField
            label="From" fullWidth placeholder="OTP Airport"
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))}
          />
          <TextField
            label="To" fullWidth placeholder="Hotel / City centre"
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))}
          />
          <TextField
            label="Operator (optional)" fullWidth placeholder="Bolt, Free Now…"
            value={transport.details.operator}
            onChange={e => setDetail('operator', e.target.value)}
          />
        </>)}

        {/* ── PRIVATE TRANSFER ── */}
        {type === 'private_transfer' && (<>
          <TextField
            label="From" fullWidth placeholder="OTP Airport"
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))}
          />
          <TextField
            label="To" fullWidth placeholder="Hotel"
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))}
          />
          <TextField
            label="Operator / provider" fullWidth placeholder="Company or driver name"
            value={transport.details.operator}
            onChange={e => setDetail('operator', e.target.value)}
          />
          <TextField
            label="Vehicle (optional)" fullWidth placeholder="Mercedes E-Class"
            value={transport.details.vehicle}
            onChange={e => setDetail('vehicle', e.target.value)}
          />
        </>)}

        {/* ── BICYCLE ── */}
        {type === 'bicycle' && (<>
          <TextField
            label="From" fullWidth
            value={transport.departureLocation}
            onChange={e => setTransport(p => ({ ...p, departureLocation: e.target.value }))}
          />
          <TextField
            label="To" fullWidth
            value={transport.arrivalLocation}
            onChange={e => setTransport(p => ({ ...p, arrivalLocation: e.target.value }))}
          />
        </>)}

        {/* ── COMMON FIELDS (all modes) ── */}
        <TextField
          label="Departure date & time" type="datetime-local"
          value={transport.departureTime}
          onChange={e => setTransport(p => ({ ...p, departureTime: e.target.value }))}
          fullWidth InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Arrival date & time" type="datetime-local"
          value={transport.arrivalTime}
          onChange={e => setTransport(p => ({ ...p, arrivalTime: e.target.value }))}
          fullWidth InputLabelProps={{ shrink: true }}
        />
        {/* Only show confirmation ref for modes where it's meaningful */}
        {!['car', 'bicycle', 'taxi'].includes(type) && (
          <TextField
            label="Confirmation ref" fullWidth
            value={transport.confirmationNumber}
            onChange={e => setTransport(p => ({ ...p, confirmationNumber: e.target.value }))}
          />
        )}
        <TextField
          label="Cost (€)" type="number" fullWidth
          value={transport.cost}
          onChange={e => setTransport(p => ({ ...p, cost: e.target.value }))}
        />
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select value={transport.status} label="Status"
            onChange={e => setTransport(p => ({ ...p, status: e.target.value }))}>
            {TRANSPORT_STATUSES.map(s => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                {s.replace('_', ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Notes" fullWidth multiline rows={2}
          value={transport.notes}
          onChange={e => setTransport(p => ({ ...p, notes: e.target.value }))}
        />
      </Box>
    );
  };

  // ── Transport card ─────────────────────────────────────────────────────────
  const TransportCard = ({ t, i }: { t: any; i: number }) => {
    const headline  = getTransportLabel(t);
    const subtitle  = getTransportSubtitle(t);
    const depTime   = t.departureTime;
    const arrTime   = t.arrivalTime;

    return (
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}>
            {transportIcon(t.type, { fontSize: 'medium' })}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>
              {headline}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
            )}
            {(depTime || arrTime) && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {depTime ? fmtDateTime(depTime) : ''}
                {arrTime ? ` → ${fmtDateTime(arrTime)}` : ''}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              {(t.details?.seat ?? t.seat) && (
                <Typography variant="caption" color="text.secondary">
                  Seat {t.details?.seat ?? t.seat}
                </Typography>
              )}
              {(t.confirmationNumber) && (
                <Typography variant="caption" color="text.secondary">
                  Ref: {t.confirmationNumber}
                </Typography>
              )}
              {t.cost && (
                <Typography variant="caption" color="text.secondary">€{t.cost}</Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            <Chip
              label={t.status.replace('_', ' ')}
              color={STATUS_COLOUR[t.status]}
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'capitalize' }}
            />
            <IconButton size="small" onClick={e => openMenu(e, 'transport', i)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    );
  };

  // ── Accommodation card ────────────────────────────────────────────────────
  const AccomCard = ({ a, i }: { a: any; i: number }) => (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <HotelIcon color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>{a.name}</Typography>
          {a.address && (
            <Typography variant="body2" color="text.secondary">{a.address}</Typography>
          )}
          {(a.checkIn || a.checkOut) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {fmtDate(a.checkIn)} → {fmtDate(a.checkOut)}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
            {a.confirmationNumber && (
              <Typography variant="caption" color="text.secondary">Ref: {a.confirmationNumber}</Typography>
            )}
            {a.cost && (
              <Typography variant="caption" color="text.secondary">€{a.cost}</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
          <Chip
            label={a.status.replace('_', ' ')}
            color={STATUS_COLOUR[a.status]}
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'capitalize' }}
          />
          <IconButton size="small" onClick={e => openMenu(e, 'accom', i)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );

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
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            fontWeight: 600,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tab label="Transport"     icon={<FlightIcon />}      iconPosition="top" />
        <Tab label="Accommodation" icon={<HotelIcon />}       iconPosition="top" />
        <Tab label="Documents"     icon={<DescriptionIcon />} iconPosition="top" />
      </Tabs>

      {/* ── Transport ── */}
      {section === 0 && (
        <Box>
          {(logistics?.transportation ?? []).map((t: any, i: number) => (
            <TransportCard key={i} t={t} i={i} />
          ))}
          {(!logistics?.transportation || logistics.transportation.length === 0) && (
            <Alert severity="info" sx={{ mb: 2 }}>No transport added yet.</Alert>
          )}
          <Button
            variant="outlined" startIcon={<AddIcon />}
            onClick={() => setTransportOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'}
            sx={{ py: mobile ? 1.5 : 1 }}
          >
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
          <Button
            variant="outlined" startIcon={<AddIcon />}
            onClick={() => setAccomOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'}
            sx={{ py: mobile ? 1.5 : 1 }}
          >
            Add accommodation
          </Button>
        </Box>
      )}

      {/* ── Documents ── */}
      {section === 2 && (
        <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>Documents</Typography>
          <Typography variant="body2" color="text.secondary">
            Passport, visa, and insurance tracking coming soon.
          </Typography>
        </Paper>
      )}

      {/* ── Context menu ── */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => { setDeleteTarget(menuTarget); closeMenu(); }}
          sx={{ color: 'error.main', gap: 1 }}
        >
          <DeleteIcon fontSize="small" /> Delete
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
      <Dialog
        open={transportOpen}
        onClose={() => setTransportOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}
      >
        <DialogTitle fontWeight={700}>Add Transport</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Type picker */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}
                sx={{ display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                Type
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {TRANSPORT_TYPES.map(({ value, label, Icon }) => (
                  <Chip
                    key={value}
                    icon={<Icon sx={{ fontSize: '1rem !important' }} />}
                    label={label}
                    onClick={() => changeType(value)}
                    variant={transport.type === value ? 'filled' : 'outlined'}
                    color={transport.type === value ? 'primary' : 'default'}
                    sx={{ fontWeight: transport.type === value ? 700 : 400 }}
                  />
                ))}
              </Box>
            </Box>

            <TransportFields />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setTransportOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveTransport} disabled={saving} fullWidth={mobile} size="large">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add accommodation dialog ── */}
      <Dialog
        open={accomOpen}
        onClose={() => setAccomOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}
      >
        <DialogTitle fontWeight={700}>Add Accommodation</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={accom.type} label="Type"
                onChange={e => setAccom(p => ({ ...p, type: e.target.value }))}>
                {ACCOM_TYPES.map(t => (
                  <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>
                    {t.replace('_', '/')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Name" fullWidth placeholder="Hotel Intercontinental"
              value={accom.name}
              onChange={e => setAccom(p => ({ ...p, name: e.target.value }))}
            />
            <TextField
              label="Address" fullWidth
              value={accom.address}
              onChange={e => setAccom(p => ({ ...p, address: e.target.value }))}
            />
            <TextField
              label="Check in" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={accom.checkIn}
              onChange={e => setAccom(p => ({ ...p, checkIn: e.target.value }))}
            />
            <TextField
              label="Check out" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={accom.checkOut}
              onChange={e => setAccom(p => ({ ...p, checkOut: e.target.value }))}
            />
            <TextField
              label="Confirmation ref" fullWidth
              value={accom.confirmationNumber}
              onChange={e => setAccom(p => ({ ...p, confirmationNumber: e.target.value }))}
            />
            <TextField
              label="Cost (€)" type="number" fullWidth
              value={accom.cost}
              onChange={e => setAccom(p => ({ ...p, cost: e.target.value }))}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={accom.status} label="Status"
                onChange={e => setAccom(p => ({ ...p, status: e.target.value }))}>
                {TRANSPORT_STATUSES.map(s => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                    {s.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes" fullWidth multiline rows={2}
              value={accom.notes}
              onChange={e => setAccom(p => ({ ...p, notes: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setAccomOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveAccom} disabled={saving} fullWidth={mobile} size="large">
            Save accommodation
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}