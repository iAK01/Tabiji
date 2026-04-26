'use client';
// LogisticsTab.tsx
// Suggested location: src/components/logistics/LogisticsTab.tsx
//
// Main orchestrator. Owns all state, API calls, offline queue, and dialogs.
// Card components are imported from separate files so React never remounts them on render.
// TransportFields is intentionally kept as a function CALL {TransportFields()} — not JSX —
// because it closes over transport state and setter. Rendering it as <TransportFields />
// would cause React to treat it as a new component type each render and remount all fields.

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Tabs, Tab, TextField,
  Select, MenuItem, FormControl, InputLabel, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, useMediaQuery, useTheme, Alert, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon           from '@mui/icons-material/Add';
import FlightIcon        from '@mui/icons-material/Flight';
import HotelIcon         from '@mui/icons-material/Hotel';
import DescriptionIcon   from '@mui/icons-material/Description';
import EditIcon          from '@mui/icons-material/Edit';
import DeleteIcon        from '@mui/icons-material/Delete';
import EventIcon         from '@mui/icons-material/Event';
import HomeIcon          from '@mui/icons-material/Home';
import AirportSearch     from '@/components/ui/AirportSearch';
import AirlineSearch     from '@/components/ui/AirlineSearch';
import AddressSearch     from '@/components/ui/AddressSearch';
import BookingLinks      from '@/components/logistics/BookingLinks';
import type { ResolvedAddress } from '@/components/ui/AddressSearch';
import { saveTripCache, getTripCache, queueAction } from '@/lib/offline/db';
import DocumentViewer from '@/components/files/DocumentViewer';
import type { ViewableFile } from '@/components/files/DocumentViewer';

// ── Sub-components (defined outside — no remount bug) ─────────────────────────
import TransportCard      from './TransportCard';
import AccomCard          from './AccomCard';
import VenueCard          from './VenueCard';
import TripDateTimePicker from '@/components/ui/TripDateTimePicker';

// ── Shared helpers ─────────────────────────────────────────────────────────────
import {
  D,
  TRANSPORT_TYPES, TRANSPORT_STATUSES, RAIL_SUBTYPES,
  VENUE_TYPES, ACCOM_TYPES,
  BLANK_TRANSPORT, BLANK_ACCOM, BLANK_VENUE,
  toDateOnly, addDays,
  detectTransportGaps,
  type TransportType, type VenueType,
  type LogisticsTabProps, type MenuKind, type GapPromptItem,
} from './logistics.helpers';

export default function LogisticsTab({ tripId, trip, fabTrigger }: LogisticsTabProps) {
  const theme  = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [section,   setSection]   = useState(0);
  const [logistics, setLogistics] = useState<any>(null);
  const [saving,    setSaving]    = useState(false);

  // Home location — fetched once from the user profile, used to pre-fill car departure
  const [homeLocation, setHomeLocation] = useState<{
    address:     string;
    coordinates: { lat: number; lng: number } | null;
  } | null>(null);

  const [transportOpen, setTransportOpen] = useState(false);
  const [transport,     setTransport]     = useState({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });

  const [accomOpen, setAccomOpen] = useState(false);
  const [accom,     setAccom]     = useState({ ...BLANK_ACCOM });

  const [venueOpen, setVenueOpen] = useState(false);
  const [venue,     setVenue]     = useState({ ...BLANK_VENUE });

  const [deleteTarget,     setDeleteTarget]     = useState<{ kind: MenuKind; index: number } | null>(null);
  const [menuPosition,     setMenuPosition]     = useState<{ top: number; left: number } | null>(null);
  const [menuTarget,       setMenuTarget]       = useState<{ kind: MenuKind; index: number } | null>(null);
  const [editTransportIdx, setEditTransportIdx] = useState<number | null>(null);
  const [editAccomIdx,     setEditAccomIdx]     = useState<number | null>(null);
  const [editVenueIdx,     setEditVenueIdx]     = useState<number | null>(null);

  // Gap detection prompts — fires after saving a flight when ground transport is missing
  const [gapPrompts, setGapPrompts] = useState<GapPromptItem[]>([]);

  const [filesById,  setFilesById]  = useState<Map<string, any[]>>(new Map());
  const [viewerFile, setViewerFile] = useState<ViewableFile | null>(null);

  // ── Load logistics + files ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadLogistics() {
      try {
        const [logRes, fileRes] = await Promise.all([
          fetch(`/api/trips/${tripId}/logistics`),
          fetch(`/api/trips/${tripId}/files`),
        ]);
        const data  = await logRes.json();
        const fData = await fileRes.json();
        setLogistics(data.logistics);
        const cached = await getTripCache(tripId);
        await saveTripCache(tripId, { ...(cached ?? {}), logistics: data.logistics });

        const map = new Map<string, any[]>();
        for (const f of (fData.files ?? [])) {
          if (f.resourceType === 'file' && f.linkedTo?.entryId) {
            const arr = map.get(f.linkedTo.entryId) ?? [];
            arr.push(f);
            map.set(f.linkedTo.entryId, arr);
          }
        }
        setFilesById(map);
      } catch {
        const cached = await getTripCache(tripId);
        if (cached?.logistics) setLogistics(cached.logistics);
      }
    }
    loadLogistics();
  }, [tripId]);

  // ── Load home location for car departure pre-fill ───────────────────────────
  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        const h = data.user?.homeLocation;
        if (!h) return;
        const parts = [h.addressLine1, h.addressLine2, h.city, h.postcode, h.country]
          .filter(Boolean)
          .join(', ');
        const coords = h.coordinates?.lat ? h.coordinates : null;
        setHomeLocation({ address: parts, coordinates: coords });
      })
      .catch(() => {});
  }, []);

  // ── FAB trigger — opens the correct dialog when the parent FAB fires ────────
  useEffect(() => {
    if (!fabTrigger) return;
    if (fabTrigger.action === 'transport') {
      setSection(0);
      setEditTransportIdx(null);
      setTransport({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });
      setTransportOpen(true);
    } else if (fabTrigger.action === 'accom') {
      setSection(1);
      setEditAccomIdx(null);
      setAccom({ ...BLANK_ACCOM });
      setAccomOpen(true);
    } else if (fabTrigger.action === 'venue') {
      setSection(2);
      setEditVenueIdx(null);
      setVenue({ ...BLANK_VENUE });
      setVenueOpen(true);
    }
  }, [fabTrigger]);

  // ── Saves ───────────────────────────────────────────────────────────────────
  const saveTransport = async () => {
    setSaving(true);
    const isEdit  = editTransportIdx !== null;
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

    // Gap detection — runs after every flight save
    if (transport.type === 'flight') {
      const gaps = detectTransportGaps(transport, data.logistics?.transportation ?? []);
      if (gaps.length > 0) setGapPrompts(gaps);
    }

    setTransportOpen(false);
    setTransport({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });
    setEditTransportIdx(null);
    setSaving(false);
  };

  const saveAccom = async () => {
    setSaving(true);
    const isEdit  = editAccomIdx !== null;
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
    const isEdit  = editVenueIdx !== null;
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

  // ── Deletes ─────────────────────────────────────────────────────────────────
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

  // ── Context menu ────────────────────────────────────────────────────────────
  const openMenu = (e: React.MouseEvent<HTMLElement>, kind: MenuKind, index: number) => {
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
      setTransport({ ...BLANK_TRANSPORT, ...t, details: { ...BLANK_TRANSPORT.details, ...(t.details ?? {}) } });
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

  // ── Formatting helpers ──────────────────────────────────────────────────────
  const fmtDateTime = (dt: string) =>
    dt ? new Date(dt).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-IE', { dateStyle: 'medium' }) : '';

  // ── Transport form helpers ──────────────────────────────────────────────────
  const setDetail = (key: string, val: any) =>
    setTransport(p => ({ ...p, details: { ...p.details, [key]: val } }));

  // When changing transport type, reset all fields but preserve the status the user chose.
  // For car type, pre-fill departure from the user's home location.
  const changeType = (newType: TransportType) => {
    const base = {
      ...BLANK_TRANSPORT,
      details: { ...BLANK_TRANSPORT.details },
      type:   newType,
      status: transport.status,
    };
    if (newType === 'car' && homeLocation) {
      base.departureLocation    = homeLocation.address;
      base.departureCoordinates = homeLocation.coordinates;
    }
    setTransport(base);
  };

  // Departure date only — drives the arrival picker's minDate and initialMonth
  const departureDateOnly = transport.departureTime ? transport.departureTime.split('T')[0] : '';

  // ── Transport form fields ─────────────────────────────────────────────────────
  // Intentionally a plain function call {TransportFields()} — NOT rendered as <TransportFields />.
  // This avoids the remount-on-render problem while keeping the closure over transport state.
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
          {homeLocation && transport.departureLocation === homeLocation.address && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <HomeIcon sx={{ fontSize: '0.9rem', color: D.navy }} />
              <Typography variant="caption" sx={{ color: D.navy, fontWeight: 600, fontFamily: D.body }}>
                Pre-filled from your home location
              </Typography>
            </Box>
          )}
          <AddressSearch
            label="From" value={transport.departureLocation}
            placeholder="Your departure address"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              departureLocation:    r?.address     ?? '',
              departureCoordinates: r?.coordinates ?? null,
            }))}
          />
          <AddressSearch
            label="To" value={transport.arrivalLocation}
            placeholder="Your destination address"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              arrivalLocation:    r?.address     ?? '',
              arrivalCoordinates: r?.coordinates ?? null,
            }))}
          />
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
          <AddressSearch
            label="From" value={transport.departureLocation}
            placeholder="Starting point"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              departureLocation:    r?.address     ?? '',
              departureCoordinates: r?.coordinates ?? null,
            }))}
          />
          <AddressSearch
            label="To" value={transport.arrivalLocation}
            placeholder="Destination"
            onChange={(r: ResolvedAddress | null) => setTransport(p => ({
              ...p,
              arrivalLocation:    r?.address     ?? '',
              arrivalCoordinates: r?.coordinates ?? null,
            }))}
          />
        </>)}

        {/* ── Common fields ── */}

        {/* Departure — constrained to trip date range, seeded to trip start */}
        <TripDateTimePicker
          label="Departure date & time"
          value={transport.departureTime}
          onChange={val => {
            // If new departure is after current arrival, clear arrival to avoid impossible range
            const newArrival = transport.arrivalTime && val > transport.arrivalTime ? '' : transport.arrivalTime;
            setTransport(p => ({ ...p, departureTime: val, arrivalTime: newArrival }));
          }}
          minDate={toDateOnly(trip.startDate)}
          maxDate={addDays(trip.endDate, 1)}
          initialMonth={toDateOnly(trip.startDate)}
        />

        {/* Arrival — min is the chosen departure date; can extend a day past trip end */}
        <TripDateTimePicker
          label="Arrival date & time"
          value={transport.arrivalTime}
          onChange={val => setTransport(p => ({ ...p, arrivalTime: val }))}
          minDate={departureDateOnly || toDateOnly(trip.startDate)}
          maxDate={addDays(trip.endDate, 2)}
          initialMonth={departureDateOnly || toDateOnly(trip.startDate)}
        />

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

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Section tabs ── */}
      <Tabs
        value={section}
        onChange={(_, v) => setSection(v)}
        variant="fullWidth"
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': { backgroundColor: D.terra, height: 3, borderRadius: '3px 3px 0 0' },
          '& .MuiTab-root': {
            minHeight: { xs: 60, sm: 52 },
            flexDirection: 'column',
            gap: 0.5,
            fontSize: { xs: '0.65rem', sm: '0.72rem' },
            fontWeight: 600,
            fontFamily: D.body,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          },
          '& .Mui-selected': {
            color: `${D.terra} !important`,
          },
        }}
      >
        <Tab label="Transport"     icon={<FlightIcon />}      iconPosition="top" />
        <Tab label="Accommodation" icon={<HotelIcon />}       iconPosition="top" />
        <Tab label="Venues"        icon={<EventIcon />}       iconPosition="top" />
        <Tab label="Documents"     icon={<DescriptionIcon />} iconPosition="top" />
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
            <TransportCard
              key={i} t={t} i={i} onMenu={openMenu} fmtDateTime={fmtDateTime}
              linkedFiles={filesById.get(String(i)) ?? []}
              onOpenFile={f => setViewerFile({ _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl })}
            />
          ))}
          {(!logistics?.transportation || logistics.transportation.length === 0) && (
            <Alert severity="info" sx={{ mb: 2, fontFamily: D.body }}>No transport added yet.</Alert>
          )}
          <Button
            variant="outlined" startIcon={<AddIcon />}
            onClick={() => setTransportOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'}
            sx={{ py: mobile ? 1.5 : 1, fontFamily: D.body }}
          >
            Add transport
          </Button>
        </Box>
      )}

      {/* ── Accommodation ── */}
      {section === 1 && (
        <Box>
          {(logistics?.accommodation ?? []).map((a: any, i: number) => (
            <AccomCard
              key={i} a={a} i={i} onMenu={openMenu} fmtDate={fmtDate}
              linkedFiles={filesById.get(String(i)) ?? []}
              onOpenFile={f => setViewerFile({ _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl })}
            />
          ))}
          {(!logistics?.accommodation || logistics.accommodation.length === 0) && (
            <Alert severity="info" sx={{ mb: 2, fontFamily: D.body }}>No accommodation added yet.</Alert>
          )}
          <Button
            variant="outlined" startIcon={<AddIcon />}
            onClick={() => setAccomOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'}
            sx={{ py: mobile ? 1.5 : 1, fontFamily: D.body }}
          >
            Add accommodation
          </Button>
        </Box>
      )}

      {/* ── Venues ── */}
      {section === 2 && (
        <Box>
          {(logistics?.venues ?? []).map((v: any, i: number) => (
            <VenueCard
              key={i} v={v} i={i} onMenu={openMenu} fmtDate={fmtDate}
              linkedFiles={filesById.get(String(i)) ?? []}
              onOpenFile={f => setViewerFile({ _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl })}
            />
          ))}
          {(!logistics?.venues || logistics.venues.length === 0) && (
            <Alert severity="info" sx={{ mb: 2, fontFamily: D.body }}>No venues added yet.</Alert>
          )}
          <Button
            variant="outlined" startIcon={<AddIcon />}
            onClick={() => setVenueOpen(true)}
            fullWidth={mobile} size={mobile ? 'large' : 'medium'}
            sx={{ py: mobile ? 1.5 : 1, fontFamily: D.body }}
          >
            Add venue
          </Button>
        </Box>
      )}

      {/* ── Documents ── */}
      {section === 3 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            bgcolor: D.paper,
            border: '1.5px solid rgba(44,62,80,0.08)',
            borderRadius: 2,
          }}
        >
          <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', mb: 0.5 }}>
            Documents
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: D.body }}>
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
        <MenuItem onClick={openEdit} sx={{ gap: 1, fontFamily: D.body }}>
          <EditIcon fontSize="small" /> Edit
        </MenuItem>
        <MenuItem
          onClick={() => { setDeleteTarget(menuTarget); closeMenu(); }}
          sx={{ color: 'error.main', gap: 1, fontFamily: D.body }}
        >
          <DeleteIcon fontSize="medium" /> Delete
        </MenuItem>
      </Menu>

      {/* ── Delete confirmation ── */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.1rem' }}>
          Delete this item?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: D.body }}>
            This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            sx={{ fontFamily: D.body }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmDelete}
            sx={{
              fontFamily: D.display, fontSize: '0.8rem',
              bgcolor: '#dc2626', boxShadow: 'none',
              '&:hover': { bgcolor: '#b91c1c', boxShadow: 'none' },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add / Edit transport dialog ── */}
      <Dialog
        open={transportOpen}
        onClose={() => setTransportOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}
      >
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.15rem' }}>
          {editTransportIdx !== null ? 'Edit Transport' : 'Add Transport'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Type selector chips */}
            <Box>
              <Typography variant="caption" color="text.secondary"
                sx={{
                  display: 'block', mb: 1,
                  textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em',
                  fontFamily: D.body, fontWeight: 600,
                }}>
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
                    sx={{
                      fontFamily: D.body,
                      fontWeight: transport.type === value ? 700 : 400,
                      ...(transport.type === value && {
                        bgcolor: D.navy,
                        '& .MuiChip-label': { color: '#fff' },
                      }),
                    }}
                  />
                ))}
              </Box>
            </Box>
            {/* Type-specific + common fields — called as a function, NOT rendered as JSX */}
            {TransportFields()}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button
            onClick={() => {
              setTransportOpen(false);
              setEditTransportIdx(null);
              setTransport({ ...BLANK_TRANSPORT, details: { ...BLANK_TRANSPORT.details } });
            }}
            fullWidth={mobile} size="large"
            sx={{ fontFamily: D.body }}
          >
            Cancel
          </Button>
          <Button
            variant="contained" onClick={saveTransport} disabled={saving}
            fullWidth={mobile} size="large"
            sx={{
              fontFamily: D.display, fontSize: '0.85rem',
              bgcolor: D.navy, boxShadow: 'none',
              '&:hover': { bgcolor: '#1a2235', boxShadow: 'none' },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add / Edit accommodation dialog ── */}
      <Dialog
        open={accomOpen}
        onClose={() => setAccomOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}
      >
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.15rem' }}>
          {editAccomIdx !== null ? 'Edit Accommodation' : 'Add Accommodation'}
        </DialogTitle>
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

            {/* ── Breakfast ── */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={accom.includesBreakfast}
                    onChange={e => setAccom(p => ({ ...p, includesBreakfast: e.target.checked }))}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: D.body }}>
                    Breakfast included
                  </Typography>
                }
              />
              {accom.includesBreakfast && (
                <TextField
                  label="Breakfast time"
                  type="time"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={accom.breakfastTime}
                  onChange={e => setAccom(p => ({ ...p, breakfastTime: e.target.value }))}
                />
              )}
            </Box>

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
          <Button
            onClick={() => { setAccomOpen(false); setEditAccomIdx(null); setAccom({ ...BLANK_ACCOM }); }}
            fullWidth={mobile} size="large"
            sx={{ fontFamily: D.body }}
          >
            Cancel
          </Button>
          <Button
            variant="contained" onClick={saveAccom} disabled={saving}
            fullWidth={mobile} size="large"
            sx={{
              fontFamily: D.display, fontSize: '0.85rem',
              bgcolor: D.navy, boxShadow: 'none',
              '&:hover': { bgcolor: '#1a2235', boxShadow: 'none' },
            }}
          >
            Save accommodation
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add / Edit venue dialog ── */}
      <Dialog
        open={venueOpen}
        onClose={() => setVenueOpen(false)}
        maxWidth="sm" fullWidth fullScreen={mobile}
      >
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.15rem' }}>
          {editVenueIdx !== null ? 'Edit Venue' : 'Add Venue'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary"
                sx={{
                  display: 'block', mb: 1,
                  textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em',
                  fontFamily: D.body, fontWeight: 600,
                }}>
                Type
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {VENUE_TYPES.map(({ value, label, Icon }) => (
                  <Chip
                    key={value}
                    icon={<Icon sx={{ fontSize: '1rem !important' }} />}
                    label={label}
                    onClick={() => setVenue(p => ({ ...p, type: value }))}
                    variant={venue.type === value ? 'filled' : 'outlined'}
                    color={venue.type === value ? 'primary' : 'default'}
                    sx={{
                      fontFamily: D.body,
                      fontWeight: venue.type === value ? 700 : 400,
                      ...(venue.type === value && {
                        bgcolor: D.navy,
                        '& .MuiChip-label': { color: '#fff' },
                      }),
                    }}
                  />
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
          <Button
            onClick={() => { setVenueOpen(false); setEditVenueIdx(null); setVenue({ ...BLANK_VENUE }); }}
            fullWidth={mobile} size="large"
            sx={{ fontFamily: D.body }}
          >
            Cancel
          </Button>
          <Button
            variant="contained" onClick={saveVenue} disabled={saving}
            fullWidth={mobile} size="large"
            sx={{
              fontFamily: D.display, fontSize: '0.85rem',
              bgcolor: D.navy, boxShadow: 'none',
              '&:hover': { bgcolor: '#1a2235', boxShadow: 'none' },
            }}
          >
            Save venue
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Gap detection prompt ── */}
      {/* Fires after saving a flight when ground transport is missing at either end */}
      <Dialog
        open={gapPrompts.length > 0}
        onClose={() => setGapPrompts([])}
        maxWidth="sm" fullWidth fullScreen={mobile}
      >
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.15rem' }}>
          A few things to sort
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {gapPrompts.map((gap, i) => (
              <Paper
                key={i}
                elevation={0}
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                  border: '1.5px solid',
                  borderColor: 'warning.light',
                  borderRadius: 2,
                  bgcolor: D.paper,
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem' }}>
                    {gap.type === 'to_airport'
                      ? `Getting to ${gap.label}`
                      : `Getting from ${gap.label}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: D.body }}>
                    {gap.type === 'to_airport'
                      ? `Flight departs ${fmtDateTime(gap.time)} — no transfer booked`
                      : `Flight arrives ${fmtDateTime(gap.time)} — no onward transfer booked`}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ flexShrink: 0, fontFamily: D.body }}
                  onClick={() => {
                    setGapPrompts(prev => prev.filter((_, j) => j !== i));
                    setTransport({
                      ...BLANK_TRANSPORT,
                      details: { ...BLANK_TRANSPORT.details },
                      ...gap.prefill,
                    });
                    setEditTransportIdx(null);
                    setSection(0);
                    setTransportOpen(true);
                  }}
                >
                  Add
                </Button>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setGapPrompts([])} sx={{ fontFamily: D.body }}>
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>

      <DocumentViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </Box>
  );
}